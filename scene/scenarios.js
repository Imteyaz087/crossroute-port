export const SCENARIOS = [
  {
    id: 'transit',
    title: 'Normal Green Channel Transit',
    body: 'Pre-cleared customs lane. Reefer holds setpoint in Eco mode; e-seal intact; CAN-bus streaming at full rate with zero temperature drift.',
    target: { temp: -18.5, soc: 82, unitMode: 'ECO · ON', canHz: 50, seal: 'SEALED · OK', drive: 1 },
    alerts: {},
    focus: 'overview',
    props: {},
    events: ['GREEN CHANNEL ✓ Pre-arrival manifest verified', 'SETPOINT -18.5°C · ΔT ±0.1°C stability', 'ETA Berth 78 quay: 14:20 CST']
  },
  {
    id: 'crane',
    title: 'Quayside Crane Disconnect & Thermal Rise',
    body: 'Reefer de-energised during Ship-to-Shore (STS) gantry crane transfer. Without external power the core begins warming; VoltEdge projects time-to-breach.',
    target: { temp: -14.2, soc: 82, unitMode: 'OFF · NO POWER', canHz: 50, seal: 'SEALED · OK', drive: 0 },
    alerts: { core: 'warn', carrier: 'crit' },
    focus: 'core',
    props: { cutaway: true },
    events: ['POWER LOSS Reefer disconnected 10:42:07', 'THERMAL INGRESS ΔT +0.18°C/min', 'Critical breach (-12°C) projected in 14 min']
  },
  {
    id: 'gate',
    title: 'Port Gate Congestion & Demurrage Alert',
    body: 'Terminal gate queue exceeds free detention window. High battery drain from auxiliary reefer load; demurrage penalty counter actively ticking.',
    target: { temp: -16.8, soc: 61, unitMode: 'ECO · BATT', canHz: 50, seal: 'SEALED · OK', drive: 0 },
    alerts: { battery: 'warn' },
    focus: 'battery',
    props: { gate: true },
    events: ['GATE QUEUE 38 trucks waiting · 72 min delay', 'DEMURRAGE RISK NT$ 3,500/day tier triggered', 'Aux reefer load on Yulon pack: -1.4 kWh/h']
  },
  {
    id: 'shore',
    title: 'Shore-Power Rapid Recovery Chill',
    body: 'Plugged into terminal 480V shore power. Carrier unit enters maximum pull-down; core rapidly recovers toward -18.5°C while tractor pack recharges.',
    target: { temp: -18.5, soc: 88, unitMode: 'PULL-DOWN · SHORE', canHz: 50, seal: 'SEALED · OK', drive: 0 },
    alerts: {},
    focus: 'carrier',
    props: { shore: true, cutaway: true },
    events: ['SHORE POWER 440V/60Hz connected', 'RAPID PULL-DOWN -0.35°C/min cooling rate', 'Tractor EV fast-charging: +120 kW']
  },
  {
    id: 'esg',
    title: 'ISO 14083 ESG Carbon Audit',
    body: 'Chain-level GHG emissions quantification per ISO 14083: Well-to-Wheel (WTW) energy consumption allocated per TEU-km with verified green grid factors.',
    target: { temp: -18.5, soc: 88, unitMode: 'ECO · ON', canHz: 10, seal: 'VERIFIED · LOGGED', drive: 0 },
    alerts: {},
    focus: 'canbus',
    props: {},
    events: ['Leg energy 41.3 kWh · WTW 9.8 kgCO₂e', 'Carbon intensity: 0.21 kgCO₂e / TEU-km', 'vs Diesel Drayage Baseline: −78% CO₂e Reduction']
  },
];
