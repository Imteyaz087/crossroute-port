// Parameter registry. Every number the physics uses lives here, in SI units,
// with a source and an `estimate` flag. Estimates are engineering judgement and
// must be calibrated against measured data before any operational use.
// SYNTHETIC DEMO · NOT OPERATIONAL. No port, carrier, OEM or agency endorses this model.

export const SOURCES = {
  iso1496: 'ISO 1496-2:2018 Thermal containers: K ≤ 0.4 W/m²K; airtightness ≤ 10 m³/h at 250 Pa (Test 13)',
  datasheetUA: '40 ft high-cube reefer datasheets: heat leakage commonly 40–50 W/K (FindInFood ISO 1496-2 explainer, Nov 2026)',
  hmm: 'HMM RF equipment page: 40\' HC reefer internal 11.58 × 2.29 × 2.545 m; Ultra Freezer −60 to −10 °C',
  carrierPL: 'Carrier PrimeLINE form 62-11248: cooling at 38 °C ambient 12.0 kW @ +2 °C, 6.6 kW @ −18 °C, 4.4 kW @ −29 °C',
  triton: 'Triton spec sheet (PrimeLINE 69NT40-561): power 6.1–8.2 kW @ −18 °C RA, 38 °C; evaporator air 5,437 m³/h high speed',
  daikinLXE: 'Daikin LXE spec page: 5.9 kW @ −18 °C / 38 °C; max power 13.5 kW; range −30…+30 °C',
  tkSF: 'Thermo King SuperFreezer spec sheet 56945: 8.25 kW @ −30 °C, 5.85 kW @ −60 °C, 3.88 kW @ −70 °C (37.8 °C ambient); max 19 kW',
  maersk: 'Maersk FAQ: standard reefer −30…+30 °C; Super Freezer −60…−10 °C',
  ghp: '食品良好衛生規範準則 (GHP), amended 2025-06-04 衛授食字第1141300945號',
  ghpDraft: 'TFDA draft guideline for low-temperature food logistics (預告 2023-05-03): 冷凍食品 品溫 ≤ −18 °C; 冷藏 ≤ 7 °C',
  jarw: 'Japan Association of Refrigerated Warehouses (jarw.or.jp/study/knowledge/1060): tuna held ≤ −50 °C to prevent discoloration (industry practice)',
  volvo: 'Volvo FH Electric: 540 kWh installed / 460 kWh usable',
  eactros: 'Mercedes-Benz eActros 600: 621 kWh installed / 600 kWh usable',
  tkSG: 'Thermo King SG-3000e clip-on genset: 473 L tank; ~2.5–3 L/h at −18 °C (dealer estimate)',
  t7: 'Evergreen Terminal 7 (S1–S5) tariff, effective 2025-12-15: reefer power NT$2,200/40\'/day; plug/unplug NT$660/action; PTI NT$2,100 (ex-tax)',
  evgDMDT: 'Evergreen Taiwan reefer DM/DT (shipmentlink TEXP_DMDT.pdf, reference only)',
  hapag: 'Hapag-Lloyd Taiwan import DM/DT from 2026-02-01 (customer letter)',
  csite: 'Case Studies in Thermal Engineering 2018, doi 10.1016/j.csite.2018.09.005 (solar effect on reefer energy)',
  physics: 'Standard heat-transfer / psychrometric relations (sol-air, Stefan–Boltzmann, Magnus)',
  est: 'Engineering estimate (not measured); calibrate before use',
};

export const p = (value, unit, source, estimate = false, note = '') => ({value, unit, source, estimate, note});

export const ENV = {
  ambientC: p(38, '°C', 'Scenario input (Kaohsiung summer peak)', true),
  rhOut: p(0.70, '-', 'est', true, 'Outdoor relative humidity'),
  solarWm2: p(1000, 'W/m²', 'Scenario input (clear-sky noon)', true),
  asphaltRiseKper1000W: p(22, 'K', 'est', true, 'Asphalt surface above ambient at 1000 W/m² (≈60 °C at 38 °C)'),
  condenserOffsetSunK: p(3, 'K', 'est', true, 'Condenser intake air above ambient from asphalt heat at 1000 W/m²'),
};

export const CONTAINER = {
  UA_W_per_K: p(45, 'W/K', 'datasheetUA', true, 'Whole-box heat leakage; ages upward'),
  meanArea_m2: p(134, 'm²', 'est', true, 'sqrt(Ai·Ae) for 40 ft HC; UA/area ≈ 0.34 W/m²K (≤ ISO 0.4)'),
  roofArea_m2: p(29.7, 'm²', 'hmm', false, '12.19 × 2.44 m exterior'),
  sideArea_m2: p(35.4, 'm²', 'hmm', false, 'One long side 12.19 × 2.9 m'),
  floorArea_m2: p(29.7, 'm²', 'hmm', false),
  airVolume_m3: p(67.5, 'm³', 'hmm', false),
  alphaRoof: p(0.45, '-', 'est', true, 'White roof: 0.25–0.35 new, 0.4–0.6 weathered'),
  sideIrradianceFrac: p(0.35, '-', 'est', true, 'Sunlit side irradiance as a fraction of horizontal'),
  hOut_W_m2K: p(20, 'W/m²K', 'est', true, 'Outside film coefficient 17–25'),
  emissivity: p(0.9, '-', 'est', true),
  leakTest_m3h: p(10, 'm³/h', 'iso1496', false, 'At 250 Pa test pressure'),
  leakServiceFrac: p(0.25, '-', 'est', true, 'In-service infiltration as fraction of ISO test leakage'),
  airNodeC_J_per_K: p(5.0e5, 'J/K', 'est', true, 'Air + inner liner + evaporator coil effective capacity'),
  evapAirflow_m3h: p(5437, 'm³/h', 'triton', false),
  doorExchangeFrac: p(0.5, '-', 'est', true, 'Fraction of internal air exchanged per door opening'),
};

// Reefer units: capacity map at reference ambient, linear in box temp between points,
// derated with ambient; electrical input via a Carnot-fraction COP.
export const UNITS = {
  primeline: {
    id: 'primeline', name: 'Carrier PrimeLINE (standard reefer)',
    capTboxC: p([2, -18, -29], '°C', 'carrierPL'), capW: p([12000, 6600, 4400], 'W', 'carrierPL'),
    refAmbientC: p(38, '°C', 'carrierPL'),
    ambientDeratePerK: p(0.017, '1/K', 'est', true, 'Capacity loss per K of condenser air above reference'),
    minSetpointC: p(-35, '°C', 'maersk', false, 'Standard reefers: −30…−35 °C'),
    etaII: p(0.28, '-', 'est', true, 'Fitted so full-load input incl. fans at −18 °C / 38 °C ≈ 7.8 kW (Triton 6.1–8.2 kW)'),
    evapApproachK: p(8, 'K', 'est', true), condApproachK: p(12, 'K', 'est', true),
    fanW: p(600, 'W', 'est', true, 'Evaporator fans; their heat enters the box'),
  },
  superfreezer: {
    id: 'superfreezer', name: 'Super-freezer (cascade, −60 °C class)',
    capTboxC: p([-30, -60, -70], '°C', 'tkSF'), capW: p([8250, 5850, 3880], 'W', 'tkSF', true, '20 ft spec applied to a 40 ft box (estimate)'),
    refAmbientC: p(37.8, '°C', 'tkSF'),
    ambientDeratePerK: p(0.017, '1/K', 'est', true),
    minSetpointC: p(-60, '°C', 'maersk'),
    etaII: p(0.30, '-', 'est', true, 'Cascade cycle'),
    evapApproachK: p(8, 'K', 'est', true), condApproachK: p(12, 'K', 'est', true),
    fanW: p(700, 'W', 'est', true),
    UA_W_per_K: p(38, 'W/K', 'est', true, 'Thicker insulation than standard box'),
  },
};

// Product thermal model: apparent heat capacity with freezing-point depression
// (ice fraction x_ice = x_w·(1 − Tf/T) below Tf).
export const CARGO = {
  frozen_meat: {
    id: 'frozen_meat', name: '進口冷凍肉品 (Frozen meat)', regime: 'frozen', unit: 'primeline',
    setpointC: p(-20, '°C', 'est', true, 'Commercial setpoint margin below the −18 °C rule'),
    massKg: p(20000, 'kg', 'est', true), cpFrozen: p(1800, 'J/kgK', 'est', true), cpUnfrozen: p(3500, 'J/kgK', 'est', true),
    waterFrac: p(0.70, '-', 'est', true), freezeC: p(-1.5, '°C', 'est', true), respW_per_t: p(0, 'W/t', 'physics'),
    valueTWD: p(3800000, 'TWD', 'Scenario input', true),
    desc: '冷凍食品 frozen food: GHP Art.4 附件一 (Annex 1) −18 °C equipment rule; Art.8 −12 °C box air during handling.',
  },
  sashimi_tuna: {
    id: 'sashimi_tuna', name: '超低溫鮪魚 (Ultra-low-temp tuna)', regime: 'frozen', unit: 'superfreezer',
    setpointC: p(-55, '°C', 'jarw', false, 'Industry practice, not law'),
    massKg: p(18000, 'kg', 'est', true), cpFrozen: p(1700, 'J/kgK', 'est', true), cpUnfrozen: p(3400, 'J/kgK', 'est', true),
    waterFrac: p(0.68, '-', 'est', true), freezeC: p(-1.5, '°C', 'est', true), respW_per_t: p(0, 'W/t', 'physics'),
    valueTWD: p(12500000, 'TWD', 'Scenario input', true),
    practiceUpperC: -50,
    desc: 'Legal rule is the general frozen-food −18 °C. −55 °C / ≤ −50 °C is industry practice (JARW) and needs a super-freezer.',
  },
  chilled_seafood: {
    id: 'chilled_seafood', name: '冷藏水產 (Chilled seafood)', regime: 'chilled', unit: 'primeline',
    setpointC: p(1, '°C', 'est', true),
    massKg: p(16000, 'kg', 'est', true), cpFrozen: p(1800, 'J/kgK', 'est', true), cpUnfrozen: p(3600, 'J/kgK', 'est', true),
    waterFrac: p(0.75, '-', 'est', true), freezeC: p(-2.0, '°C', 'est', true), respW_per_t: p(0, 'W/t', 'physics'),
    valueTWD: p(4200000, 'TWD', 'Scenario input', true),
    desc: '冷藏食品 chilled food: GHP Art.4 附件一 ≤ 7 °C and above freezing point; Art.8 ≤ 7 °C box air during handling.',
  },
  fresh_produce: {
    id: 'fresh_produce', name: '外銷鮮果 (Fresh mango)', regime: 'produce', unit: 'primeline',
    setpointC: p(12, '°C', 'est', true, 'Above chilling-injury range'),
    massKg: p(15000, 'kg', 'est', true), cpFrozen: p(1900, 'J/kgK', 'est', true), cpUnfrozen: p(3600, 'J/kgK', 'est', true),
    waterFrac: p(0.82, '-', 'est', true), freezeC: p(-1.0, '°C', 'est', true),
    respW_per_t: p(60, 'W/t', 'est', true, 'Respiration heat at 12 °C, Q10 ≈ 2'),
    valueTWD: p(1200000, 'TWD', 'Scenario input', true),
    bandC: [10, 15],
    desc: 'Quality band 10–15 °C (estimate). Not a GHP chilled-food limit; chilling injury below ~10 °C.',
  },
};

export const PRODUCT_SPLIT = {
  surfaceFrac: p(0.15, '-', 'est', true, 'Mass fraction in the outer carton layer'),
  hA_air_surface_W_per_K: p(400, 'W/K', 'est', true, 'Forced-air film × exposed pallet area'),
  G_surface_core_W_per_K: p(150, 'W/K', 'est', true, 'Conduction through cartons'),
};

export const MOBILE = {
  usableKWh: p(282, 'kWh', 'est', true, 'Generic drayage tractor; Volvo FH Electric 460, eActros 600 600 kWh usable'),
  inverterEff: p(0.93, '-', 'est', true, 'DC→3φ AC 0.92–0.95'),
  auxW: p(1500, 'W', 'est', true, 'Cab HVAC + auxiliaries while queuing'),
  driveW: p(25000, 'W', 'est', true, 'Average traction power while moving in terminal'),
  gensetTankL: p(473, 'L', 'tkSG'),
  gensetIdleLph: p(0.9, 'L/h', 'est', true, 'Willans line intercept'),
  gensetLperKWh: p(0.25, 'L/kWh', 'est', true, 'Gives ~2.6 L/h at 7 kW (dealer 2.5–3)'),
  gensetCutoffFrac: p(0.05, '-', 'est', true, 'Low-fuel shutdown'),
};

export const COSTS = {
  plugUnplugTWD: p(660, 'TWD/action', 't7'),
  reeferPowerTWDperDay40: p(2200, 'TWD/day', 't7'),
  dieselTWDperL: p(30, 'TWD/L', 'est', true),
  electricityTWDperKWh: p(5, 'TWD/kWh', 'est', true),
  truckTWDperHour: p(900, 'TWD/h', 'est', true, 'Trucker time cost'),
};

// Reference only: day-based charges. A 45–90 min queue does not trigger these by itself.
export const DMDT_REFERENCE = [
  {source: 'evgDMDT', kind: 'Reefer demurrage (Evergreen)', free: 'Days 1–5', tiers: 'D6–8 NT$1,100/2,500 · D9+ NT$3,000/5,000 (20\'/40\', +5% VAT)'},
  {source: 'evgDMDT', kind: 'Reefer detention (Evergreen)', free: 'Days 1–5', tiers: 'D6–8 NT$1,100/1,200 · D9+ NT$3,000/3,900'},
  {source: 'hapag', kind: 'Reefer demurrage, import (Hapag-Lloyd)', free: 'Days 1–3', tiers: 'D4–6 NT$1,800/3,000 · D7+ NT$3,600/6,000'},
  {source: 'hapag', kind: 'Reefer detention, import (Hapag-Lloyd)', free: 'Days 1–3', tiers: 'D4–6 NT$1,500/2,500 · D7+ NT$3,000/5,000'},
  {source: 't7', kind: 'Terminal 7 reefer services', free: '—', tiers: 'Power NT$2,200/40\'/day · plug/unplug NT$660 · PTI NT$2,100'},
];

export const v = x => x && typeof x === 'object' && 'value' in x ? x.value : x;

// Flatten the registry for the sources drawer.
export function registry() {
  const rows = [];
  const walk = (group, obj) => {
    for (const [k, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && 'value' in val && 'source' in val) rows.push({group, key: k, ...val, sourceText: SOURCES[val.source] || val.source});
      else if (val && typeof val === 'object' && !Array.isArray(val)) walk(`${group}.${k}`, val);
    }
  };
  walk('ENV', ENV); walk('CONTAINER', CONTAINER); walk('UNITS', UNITS); walk('CARGO', CARGO);
  walk('PRODUCT_SPLIT', PRODUCT_SPLIT); walk('MOBILE', MOBILE); walk('COSTS', COSTS);
  return rows;
}
