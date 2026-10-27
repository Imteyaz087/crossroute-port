export const CARGO_CATALOG = {
  frozen_meat: {
    id: 'frozen_meat',
    name: '進口冷凍牛豬肉 (Frozen Meat)',
    prechill: -18.5,
    critical: -15.0,
    cp: 1.8,             // kJ/(kg·K)
    payloadTon: 20.0,
    valueTWD: 3800000,
    desc: '標準進口肉品 · HACCP 規定核心不得高於 -15°C'
  },
  sashimi_tuna: {
    id: 'sashimi_tuna',
    name: '遠洋超低溫黑鮪魚 (Sashimi Tuna)',
    prechill: -55.0,
    critical: -45.0,
    cp: 1.6,
    payloadTon: 18.0,
    valueTWD: 12500000,
    desc: '日本外銷生食級 · 超低溫急速凍結 高度溫敏'
  },
  pharma_vaccine: {
    id: 'pharma_vaccine',
    name: '醫藥生技疫苗製劑 (Biologics/Pharma)',
    prechill: 4.0,
    critical: 8.0,
    cp: 3.8,
    payloadTon: 8.0,
    valueTWD: 28000000,
    desc: 'PIC/S GDP 冷鏈藥品 · 嚴格 2°C–8°C 恆溫區間'
  },
  fresh_produce: {
    id: 'fresh_produce',
    name: '頂級外銷亞熱帶鮮果 (Fresh Mango/Produce)',
    prechill: 12.0,
    critical: 15.0,
    cp: 3.6,
    payloadTon: 15.0,
    valueTWD: 1200000,
    desc: '產銷履歷芒果/釋迦 · 抑制呼吸熱 乙烯防衰'
  }
};

const TARE_HEAT_CAPACITY_J = 2058000;
const SOLAR_LOAD_W = 4470;
const LEAK_RATE_W_PER_K = 28.5; // High-Cube insulated composite wall
const SHORE_POWER_KW = 10.0;
const CARRIER_ECO_KW = 7.5;

export function createTelemetry() {
  let activeCargo = CARGO_CATALOG.frozen_meat;
  let ambientC = 32.0; // Summer Kaohsiung port baseline

  const s = {
    cargo: activeCargo,
    ambientC: ambientC,
    temp: activeCargo.prechill,
    targetTemp: activeCargo.prechill,
    peakTemp: activeCargo.prechill,
    soc: 82,
    unitMode: 'ECO · ON',
    canHz: 50,
    seal: 'SEALED · OK',
    drive: 1,
    alerts: {},
    target: null,
    heatIngressKw: 0,
    marginC: 3.5,
    withinRef: true,
    // CFO Financial Metrics
    spoilageAtRiskTWD: 0,
    spoilageAvoidedTWD: activeCargo.valueTWD,
    demurrageAvoidedTWD: 3500,
    energySavedPerTripTWD: 1610,
    co2eAvoidedKg: 42.8
  };

  function updateThermodynamics(dt) {
    const cargo = s.cargo;
    const isPowerOff = s.unitMode.startsWith('OFF');
    const isPullDown = s.unitMode.startsWith('PULL');
    const isEco = s.unitMode.startsWith('ECO');

    // W = U * A * (Tambient - Tcore) + Wsolar
    const deltaT = Math.max(0, s.ambientC - s.temp);
    const ingressW = LEAK_RATE_W_PER_K * deltaT + (isPowerOff ? SOLAR_LOAD_W : SOLAR_LOAD_W * 0.4);
    s.heatIngressKw = ingressW / 1000;

    let coolingCapacityW = 0;
    if (isPullDown) coolingCapacityW = SHORE_POWER_KW * 1000;
    else if (isEco) coolingCapacityW = CARRIER_ECO_KW * 1000;

    const netPowerW = coolingCapacityW - ingressW;
    const totalCapacityJ = cargo.payloadTon * 1000 * cargo.cp * 1000 + TARE_HEAT_CAPACITY_J;

    // dT/dt in real time (scaled for responsive demonstration)
    const timeScale = 120.0; // 1 second simulated = 2 minutes real thermal drift
    const dT = (-netPowerW / totalCapacityJ) * (dt * timeScale);

    if (isPowerOff) {
      s.temp += Math.abs(dT);
    } else {
      if (s.temp > s.targetTemp) {
        s.temp = Math.max(s.targetTemp, s.temp + dT);
      } else {
        s.temp += (s.targetTemp - s.temp) * 0.05;
      }
    }

    s.marginC = cargo.critical - s.temp;
    s.withinRef = s.temp <= cargo.critical;

    // Financial Ticker State Machine
    if (s.withinRef) {
      s.spoilageAtRiskTWD = 0;
      s.spoilageAvoidedTWD = cargo.valueTWD;
    } else {
      // Exceeds critical temperature: damage escalates with thermal penetration
      const excessC = s.temp - cargo.critical;
      const riskFraction = Math.min(1.0, excessC / 3.0);
      s.spoilageAtRiskTWD = Math.round(cargo.valueTWD * riskFraction);
      s.spoilageAvoidedTWD = cargo.valueTWD - s.spoilageAtRiskTWD;
    }
  }

  return {
    state: s,
    setCargo(cargoKey) {
      if (CARGO_CATALOG[cargoKey]) {
        activeCargo = CARGO_CATALOG[cargoKey];
        s.cargo = activeCargo;
        s.temp = activeCargo.prechill;
        s.targetTemp = activeCargo.prechill;
        s.spoilageAvoidedTWD = activeCargo.valueTWD;
        s.spoilageAtRiskTWD = 0;
      }
    },
    setAmbient(degC) {
      s.ambientC = degC;
    },
    apply(sc) {
      s.target = sc.target;
      s.alerts = { ...sc.alerts };
      s.unitMode = sc.target.unitMode;
      s.seal = sc.target.seal;
      s.canHz = sc.target.canHz;
      s.targetTemp = sc.target.temp !== undefined ? sc.target.temp : s.cargo.prechill;
      s.demurrageAvoidedTWD = sc.id === 'gate' ? 7000 : 3500;
    },
    tick(dt) {
      updateThermodynamics(dt);
      if (!s.target) return;
      const k = 1 - Math.exp(-dt * 0.9);
      s.soc += (s.target.soc - s.soc) * k * 0.4;
      s.drive += (s.target.drive - s.drive) * k;

      // Update alert levels dynamically based on physical margin
      if (s.temp > s.cargo.critical) {
        s.alerts.core = 'crit';
      } else if (s.temp > s.cargo.critical - 1.5) {
        s.alerts.core = 'warn';
      } else {
        delete s.alerts.core;
      }
    },
  };
}
