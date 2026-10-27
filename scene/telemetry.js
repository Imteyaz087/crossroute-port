export function createTelemetry() {
  const s = {
    temp: -18.5,
    soc: 82,
    unitMode: 'ECO · ON',
    canHz: 50,
    seal: 'SEALED · OK',
    drive: 1,
    alerts: {},
    target: null
  };

  return {
    state: s,
    apply(sc) {
      s.target = sc.target;
      s.alerts = sc.alerts;
      s.unitMode = sc.target.unitMode;
      s.seal = sc.target.seal;
      s.canHz = sc.target.canHz;
    },
    tick(dt) {
      if (!s.target) return;
      const k = 1 - Math.exp(-dt * 0.9);
      s.temp += (s.target.temp - s.temp) * k * 0.6;
      s.soc  += (s.target.soc  - s.soc)  * k * 0.4;
      s.drive += (s.target.drive - s.drive) * k;
    },
  };
}
