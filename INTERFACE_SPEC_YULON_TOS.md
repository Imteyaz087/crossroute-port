# CrossRoute Enterprise Telematics & Port TOS Interface Specification
## Technical Integration Contract for Yulon Group (Track 15-M) & Kaohsiung Port (TIPC)

---

### 1. Overview & Architectural Scope
This document specifies the cyber-physical interface contracts for integrating the **CrossRoute Zero-Genset Thermal Budgeting Engine (DTBE)** into:
1. **Yulon Group / China Motor (CMC)** Commercial Electric Fleet (**ET35** 3.5T Vans & Heavy Haulage e-Tractors).
2. **Car Plus Mobility (格上租車)** Telematics Fleet Management System (FMS).
3. **Marine Reefer Controllers** (Carrier Transicold DataLine & Thermo King MP-4000).
4. **Taiwan International Ports Corporation (TIPC / 臺灣港務公司)** Terminal Operating System (TOS).

---

### 2. Vehicle CAN-Bus & FMS Interface (Yulon CMC / Car Plus)

#### Physical & Data Link Layer:
* **Standard**: ISO 11898 / SAE J1939 (High-Speed CAN 250 kbps / 500 kbps).
* **Connector**: OBD-II (Type B) or Deutsch 9-Pin J1939 Diagnostic Port.
* **Edge Gateway**: CrossRoute Telematics Box (T-Box) with Quectel BG95 4G/LTE Cat-M1 + GNSS dead-reckoning.

#### Ingested Parameter Group Numbers (PGN):
| PGN | Parameter Name | SPN | Resolution | Update Rate | Purpose |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **65265** | Cruise Control / Vehicle Speed | 84 | 1/256 km/h per bit | 100 ms | Real-time drayage velocity & ETA calculation |
| **65266** | High-Voltage Battery Pack State (EV) | 3058 | 0.4% / bit | 100 ms | CMC ET35 EV battery SoC & range impact |
| **61444** | Electronic Engine / Motor Controller | 190 | 0.125 rpm / bit | 20 ms | Powertrain load & energy efficiency modeling |
| **65269** | Ambient Environmental Conditions | 171 | 0.03125 °C / bit | 1,000 ms | Ambient temperature cross-check against Open-Meteo |

---

### 3. Marine Reefer Microcontroller Interface (RS-485 / Modbus RTU)

#### Physical & Data Link Layer:
* **Standard**: EIA/TIA-485 Half-Duplex (9600 bps, 8 Data Bits, 1 Stop Bit, No Parity).
* **Supported Units**: Carrier Transicold PrimeLINE / ThinLINE (DataLine protocol) & Thermo King Magnum Plus (MP-4000).

#### Modbus Holding Registers (Read-Only 0x03):
| Register | Parameter | Unit | Scaling | Fault Condition |
| :---: | :--- | :---: | :---: | :--- |
| **30001** | Return Air Temperature (Cargo Core Indicator) | °C | 0.01 °C / LSB | Null or > 50°C -> Immediate ABORT |
| **30002** | Supply Air Temperature (Evaporator Air) | °C | 0.01 °C / LSB | Null or > 50°C -> Immediate ABORT |
| **30003** | Evaporator Coil Temperature | °C | 0.01 °C / LSB | Frost accumulation monitoring |
| **30004** | Active Temperature Setpoint | °C | 0.01 °C / LSB | Pre-chill verification (-19.5°C) |
| **30010** | Compressor Power State | Enum | 0=OFF, 1=ON | 0 during genset-free transit |
| **30012** | Defrost Cycle Status | Bitfield | Bit 0: In Defrost | Inhibit transit during active defrost |

---

### 4. Kaohsiung Port Terminal Operating System (TOS) & EDI Interface

#### Ingestion Standard:
* **Protocol**: UN/EDIFACT (Electronic Data Interchange for Administration, Commerce and Transport) via Secure AS2 / RESTful Webhooks.

#### Supported Message Types:
1. **CODECO (Gate In / Gate Out Container Report)**:
   * Triggers the CrossRoute "Zero-Genset Green Pass" upon terminal gate passage.
   * Feeds Berth Unplug Timestamp ($t_{\text{unplug}}$) and initial pre-chill departure temperature.
2. **COARRI (Container Discharge / Loading Report)**:
   * Synchronizes SugarSense vessel berthing time with haulier drayage truck call-up, preventing idle queue times.
3. **REEFER_MON (Shore Power Monitoring Telemetry)**:
   * Verifies that the container received at least 4 hours of $-19.5^\circ\text{C}$ continuous shore-power pre-chilling before detachment.

---

### 5. In-Cab Safety Protocol & Driver Handoff

```
[Normal Drayage]      Air ΔT < +1.0°C   ──>  [GREEN PASS: GO] (Thermal Margin > 30m)
[Traffic Delay]       Air ΔT ≥ +1.0°C   ──>  [THERMAL WATCH]  (Audible in-cab chime)
[Safety Breach/Fault] Air ΔT ≥ +1.8°C   ──>  [EMERGENCY ABORT]
                                             • In-cab visual RED alert + voice guidance
                                             • Auto-routes truck to Xiaogang Gate 4 Shore Plug (3.8 km)
                                             • Alerts Car Plus fleet dispatcher
```

---

### 6. Audit Trail & Data Governance
* **Asymmetric Cryptography**: Every completed trip generates an Ed25519 digitally signed audit file (`trip.json`) chained with a SHA-256 Merkle root.
* **ISO 14083 / GLEC Compliance**: Emissions calculations follow Well-to-Wheel (WTW) standards with immutable energy balance records verifiable offline via `crossroute_verifier.py`.
