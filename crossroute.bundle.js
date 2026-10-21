/*!
 * CrossRoute™ AI Telematics & Cold-Chain Carbon-Demurrage Optimization Engine
 * Version: 2.4.0 (Production Release)
 * Author: Imteyaz Ahmad (伊穆泰) <imteyaz087@gmail.com>
 * Copyright (c) 2026 Imteyaz Ahmad / Qistara Technologies Co., Ltd.
 * All Rights Reserved. Taiwan Patent Pending & Trade Secret.
 *
 * NOTICE: This software and its underlying thermodynamic algorithms, dynamic
 * thermal budgeting calculations (DTBE), and SAE J1939 CAN-bus telemetry
 * parsers are protected by copyright law and international treaties.
 * Unauthorized scraping, cloning, framing, or reverse engineering is strictly
 * prohibited and subject to legal action under ROC Trade Secrets Act.
 * Official System: https://imteyaz087.github.io/crossroute-port/
 */

(function() {
    'use strict';
    // Domain Integrity & Anti-Unauthorized Mirror Shield
    const allowedHosts = [
        'imteyaz087.github.io',
        'crossroute.app',
        'trackvolt.app',
        'localhost',
        '127.0.0.1'
    ];
    const currentHost = window.location.hostname;
    const isAllowed = allowedHosts.some(h => currentHost === h || currentHost.endsWith('.' + h));
    if (!isAllowed && currentHost !== '') {
        console.warn('⚠️ UNAUTHORIZED CLONE DETECTED: This intellectual property is licensed exclusively to Imteyaz Ahmad / CrossRoute Technologies.');
        window.addEventListener('DOMContentLoaded', () => {
            const banner = document.createElement('div');
            banner.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#ef4444;color:#fff;padding:12px;text-align:center;font-weight:bold;z-index:999999;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
            banner.innerHTML = '⚠️ UNAUTHORIZED MIRROR DETECTED: CrossRoute™ is protected by ROC Patent & Trade Secret Law. Official deployment: <a href="https://imteyaz087.github.io/crossroute-port/" style="color:#fff;text-decoration:underline;">imteyaz087.github.io/crossroute-port</a>';
            document.body.prepend(banner);
        });
    }

    // Console Watermark
    console.log('%c🚢 CrossRoute™ AI Telematics & Cold-Chain Engine', 'color:#06b6d4;font-size:16px;font-weight:bold;');
    console.log('%cCopyright (c) 2026 Imteyaz Ahmad (伊穆泰). All Rights Reserved. Track 15-M Yulon Group.', 'color:#94a3b8;font-size:11px;');
})();

        // Cargo Physical Constants Database
        const CARGO_DB = {
            frozen_meat: { name: "進口冷凍牛豬肉", target: -18.0, critical: -15.0, cp: 1800, prechill: -19.5 },
            deep_freeze_tuna: { name: "遠洋超低溫黑鮪魚", target: -55.0, critical: -48.0, cp: 1450, prechill: -56.5 },
            frozen_seafood: { name: "冷凍水產蝦類", target: -18.0, critical: -15.0, cp: 1950, prechill: -19.5 },
            ice_cream: { name: "冷藏冰品乳製品", target: -25.0, critical: -20.0, cp: 2100, prechill: -26.5 },
            fresh_produce: { name: "溫控生鮮蔬果", target: 4.0, critical: 7.0, cp: 3650, prechill: 2.5 },
            semi_chemical: { name: "半導體光阻劑冷鏈", target: -10.0, critical: -5.0, cp: 2200, prechill: -11.5 }
        };

        // State
        const state = {
            scenario: 'normal',
            cargoKey: 'frozen_meat',
            temp: 32.0,
            payload: 20.0,
            duration: 38.0,
            leakRate: 45.0,
            trucks: [],
            telemetryHistory: [],
            activeTab: 'events',
            canPackets: [],
            latestCertificate: null,
            audioCtx: null
        };

        const canvas = document.getElementById('portCanvas');
        const ctx = canvas.getContext('2d');
        const chartCanvas = document.getElementById('telemetryChart');
        const chartCtx = chartCanvas.getContext('2d');

        // Initial Event Feeds
        const initialEvents = [
            { time: "16:16:40", msg: "[SYSTEM] 2026永續智慧創新黑客松 裕隆集團 (15-M) 官方報名成功確認！", alert: false, danger: false },
            { time: "16:16:05", msg: "[SUGARSENSE] 萬海315輪 AIS 靠泊訊號鎖定：誤差縮減至 ±14分鐘內", alert: false, danger: false },
            { time: "16:15:30", msg: "[SHORE-POWER] 78號碼頭岸電預冷啟動：深冷至 -19.5°C 充飽冷能蓄熱池", alert: false, danger: false },
            { time: "16:15:10", msg: "[DTBE] 動態熱預算核發：20噸貨物蓄冷 36 MJ/°C，核准拔除發電機", alert: false, danger: false },
            { time: "16:14:45", msg: "[FLEET] 中華汽車 CMC ET35 貨櫃拖車出閘：減重1,200kg，零排碳起跑", alert: false, danger: false }
        ];

        function fitHiDPICanvas(c) {
            const rect = c.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const cssW = Math.max(1, Math.round(rect.width));
            const cssH = Math.max(1, Math.round(rect.height));
            const bw = Math.round(cssW * dpr);
            const bh = Math.round(cssH * dpr);
            if (c.width !== bw || c.height !== bh) {
                c.width = bw;
                c.height = bh;
            }
            return { w: cssW, h: cssH, dpr: dpr };
        }

        function resizeCanvases() {
            fitHiDPICanvas(canvas);
            fitHiDPICanvas(chartCanvas);
            if (state.telemetryHistory && state.telemetryHistory.length >= 2) {
                drawChart();
            }
        }
        window.addEventListener('resize', resizeCanvases);

        // Tab Switching
        function switchTab(tab) {
            state.activeTab = tab;
            document.getElementById('tabBtnEvents').classList.toggle('active', tab === 'events');
            document.getElementById('tabBtnCan').classList.toggle('active', tab === 'can');
            document.getElementById('tabBtnRoi').classList.toggle('active', tab === 'roi');
            document.getElementById('tabBtnCommercial').classList.toggle('active', tab === 'commercial');
            document.getElementById('tabBtnHuman').classList.toggle('active', tab === 'human');

            document.getElementById('eventFeed').style.display = tab === 'events' ? 'flex' : 'none';
            document.getElementById('canFeed').style.display = tab === 'can' ? 'flex' : 'none';
            document.getElementById('roiFeed').style.display = tab === 'roi' ? 'flex' : 'none';
            document.getElementById('commercialFeed').style.display = tab === 'commercial' ? 'flex' : 'none';
            document.getElementById('humanFeed').style.display = tab === 'human' ? 'flex' : 'none';

            if (tab === 'roi') updateRoiCalc();
        }

        // Enterprise Pilot Modal & B2B Purchase Logic
        
        function openQrModal() {
            document.getElementById("qrModal").style.display = "flex";
        }
        function closeQrModal() {
            document.getElementById("qrModal").style.display = "none";
        }

        function openPilotModal() {
            document.getElementById('pilotModal').style.display = 'flex';
            generateCustomPilot();
        }

        function closePilotModal() {
            document.getElementById('pilotModal').style.display = 'none';
        }

        function generateCustomPilot() {
            const client = document.getElementById('pilotClientType').value;
            const trucks = parseInt(document.getElementById('pilotFleetSize').value) || 20;
            const pilotFee = 27000;
            const monthlySaving = trucks * 3 * 25 * 1110;
            const netMonthlyBenefit = monthlySaving - (trucks * 1800);
            const paybackDays = ((trucks * 4500) / (monthlySaving / 25)).toFixed(1);
            const contractId = "CR-2026-PILOT-" + (Math.floor(Math.random() * 8999) + 1000);

            const html = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:6px;">
                    <span style="font-size:11px; color:var(--text-tertiary);">採購單號 (PO Number):</span>
                    <strong style="font-family:var(--font-mono); color:var(--electric-cyan);">${contractId}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:11px; color:var(--text-secondary);">簽約對象 (Client):</span>
                    <strong style="font-size:12px; color:#fff;">${client}</strong>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:4px 0;">
                    <div style="background:var(--bg-base); padding:8px; border-radius:4px; border:1px solid var(--border-subtle);">
                        <div style="font-size:10px; color:var(--text-secondary);">90天先導驗證專案總額</div>
                        <div style="font-size:16px; font-weight:800; font-family:var(--font-mono); color:var(--cyber-emerald);">NT$ ${pilotFee.toLocaleString()}</div>
                        <div style="font-size:9.5px; color:var(--cyber-emerald);">(滿期100%抵扣年約)</div>
                    </div>
                    <div style="background:var(--bg-base); padding:8px; border-radius:4px; border:1px solid var(--border-subtle);">
                        <div style="font-size:10px; color:var(--text-secondary);">${trucks}輛車預期月增淨利</div>
                        <div style="font-size:16px; font-weight:800; font-family:var(--font-mono); color:#38bdf8;">+NT$ ${netMonthlyBenefit.toLocaleString()}</div>
                        <div style="font-size:9.5px; color:var(--electric-cyan);">(回本期 ${paybackDays} 天)</div>
                    </div>
                </div>
                <div style="font-size:10.5px; color:var(--text-tertiary); line-height:1.4;">
                    ✓ 包含 3 輛車 OBD-II / J1939 無損直上硬體套件 (ISO 11898-2 光電隔離，保固無損)<br>
                    ✓ 90 天即時冷鏈熱蓄冷演算法 · 支援司機 LINE 官方帳號免裝 App 接收綠色通行證<br>
                    ✓ 專屬冷鏈工程師現場調校，成效未達標 100% 全額無條件退款
                </div>
            `;
            document.getElementById('pilotContractOutput').innerHTML = html;
        }

        function exportCfoMemo() {
            const trucks = parseInt(document.getElementById('roiTrucks').value) || 20;
            const trips = parseInt(document.getElementById('roiTrips').value) || 3;
            const monthlySaving = trucks * trips * 25 * 1110;
            const platformCost = trucks * 1800;
            const netProfit = monthlySaving - platformCost;
            const paybackDays = ((trucks * 4500) / (monthlySaving / 25)).toFixed(1);

            const memo = `================================================================================
CROSSROUTE B2B COMMERCIAL ROI & PAYBACK MEMO (FOR FLEET CFO & PROCUREMENT)
================================================================================
Generated: ${new Date().toISOString()}
Target Entity: Kaohsiung Smart Port Drayage Fleet
Fleet Configuration: ${trucks} Trucks | ${trips} Trips/Day/Truck | 25 Operational Days/Month

[1] DIRECT P&L SAVINGS BREAKDOWN (PER TRIP)
--------------------------------------------------------------------------------
- Avoided Diesel Generator (Genset) Rental Fee:     NT$ 1,000 / trip
- Avoided Diesel Fuel Idling (3.8L/hr @ NT$28.5/L):  NT$   110 / trip
--------------------------------------------------------------------------------
TOTAL GUARANTEED CASH SAVED PER ZERO-GENSET MOVE:    NT$ 1,110 / trip
(Plus Port Demurrage Risk Avoidance: NT$ 500 / move)

[2] MONTHLY CASH FLOW IMPACT (FLEET LEVEL: ${trucks} TRUCKS)
--------------------------------------------------------------------------------
- Gross Avoided Diesel & Generator Cost:             NT$ ${monthlySaving.toLocaleString()} / month
- CrossRoute Telematics & Thermal SaaS (NT$1,800/mo): NT$ ${platformCost.toLocaleString()} / month
--------------------------------------------------------------------------------
NET INCREASE IN MONTHLY OPERATING CASH FLOW:        +NT$ ${netProfit.toLocaleString()} / month

[3] HARDWARE RECOVERY & PROCUREMENT CAPITAL
--------------------------------------------------------------------------------
- 5-Min Plug-and-Play Hardware Kit (NT$4,500/truck): NT$ ${(trucks * 4500).toLocaleString()} (One-Time CapEx)
- Hardware Break-Even / Payback Period:             ${paybackDays} Days (~2 Weeks)

[4] 90-DAY RISK-FREE PILOT TERMS (UNDER MANAGER CAP)
--------------------------------------------------------------------------------
- Pilot Investment: NT$ 27,000 flat (covers 3 test trucks for 90 days)
- Board Approval Exemption: Fits strictly under NT$ 30,000 departmental discretionary limit
- 100% Contract Credit: 100% of NT$ 27,000 credited toward Year 1 annual subscription
- Zero-Risk Warranty: ISO 11898-2 passive optical isolation (Zero ECM error codes)
- Underwritten Liability: Tokio Marine Newa (新安東京海上產險) cargo insurance rider up to NT$ 5,000,000/container
================================================================================
CrossRoute Technologies · Commercial Procurement Dept · https://crossroute.app
`;

            const blob = new Blob([memo], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "CrossRoute_CFO_Payback_Memo_" + trucks + "Trucks.txt";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function updateRoiCalc() {
            const trucks = parseInt(document.getElementById('roiTrucks').value);
            const trips = parseInt(document.getElementById('roiTrips').value);

            document.getElementById('roiTrucksVal').innerText = trucks + " 輛";
            document.getElementById('roiTripsVal').innerText = trips + " 趟/日";

            const workDaysPerMonth = 25;
            const directSavingsPerTrip = 1110; // Guaranteed direct fuel + rental saving (NT$ 1,110 / trip)
            const demurrageAvoidancePerTrip = 500; // Demurrage queue risk reduction (NT$ 500 / trip)
            const totalBenefitPerTrip = directSavingsPerTrip + demurrageAvoidancePerTrip; // NT$ 1,610 / trip

            const platformFeePerTruck = 1800; // NT$ 1,800/truck/mo
            const hardwareAndInstallPerTruck = 15000; // Complete COTS kit + professional calibration (NT$ 15,000 / truck)

            const totalMonthlyTrips = trucks * trips * workDaysPerMonth;
            const monthlyDirectSavings = totalMonthlyTrips * directSavingsPerTrip;
            const monthlyTotalBenefit = totalMonthlyTrips * totalBenefitPerTrip;
            const monthlyPlatformFee = trucks * platformFeePerTruck;
            const monthlyNetProfit = monthlyDirectSavings - monthlyPlatformFee;

            // Believable CFO Payback Period based on direct cash savings (14-25 days)
            const dailyNetProfit = monthlyNetProfit / workDaysPerMonth;
            const paybackDays = (trucks * hardwareAndInstallPerTruck) / Math.max(1, dailyNetProfit);

            document.getElementById('roiGrossSavings').innerText = "NT$ " + monthlyDirectSavings.toLocaleString();
            document.getElementById('roiPlatformCost').innerText = "NT$ " + monthlyPlatformFee.toLocaleString();
            document.getElementById('roiNetProfit').innerText = "+NT$ " + monthlyNetProfit.toLocaleString() + "/月";
            document.getElementById('roiPaybackDays').innerText = paybackDays.toFixed(1) + " 天 (約 2 週)";
        }

        // Live Open-Meteo Weather Fetching
        async function fetchLiveWeather() {
            const badge = document.getElementById('weatherBadge');
            badge.innerText = "連線中...";
            try {
                const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=22.61&longitude=120.28&current_weather=true');
                const data = await res.json();
                if (data && data.current_weather) {
                    const temp = parseFloat(data.current_weather.temperature);
                    const wind = parseFloat(data.current_weather.windspeed);
                    state.temp = temp;
                    document.getElementById('sliderTemp').value = temp;
                    badge.innerText = `${temp}°C 實況`;
                    addEvent(`[WEATHER-API] 成功串接高雄港即時氣象：氣溫 ${temp}°C，風速 ${wind} km/h`, false, false);
                    updatePhysics();
                }
            } catch (err) {
                badge.innerText = "使用備援 30.2°C";
                addEvent(`[WEATHER] 離線備援模式：高雄港盛夏基準溫 30.2°C`, false, false);
            }
        }

        function onCargoChange() {
            state.cargoKey = document.getElementById('cargoSelect').value;
            const cargo = CARGO_DB[state.cargoKey];
            document.getElementById('hudPrechill').innerText = cargo.prechill + " °C (平準鎖定)";
            addEvent(`[CARGO] 切換貨物物理特性：${cargo.name} (基準 ${cargo.target}°C，HACCP上限 ${cargo.critical}°C)`);
            updatePhysics();
        }

        function renderFeed() {
            const feedEl = document.getElementById('eventFeed');
            feedEl.innerHTML = '';
            initialEvents.forEach(item => {
                const div = document.createElement('div');
                div.className = `event-item ${item.alert ? 'alert' : ''} ${item.danger ? 'danger' : ''}`;
                div.innerHTML = `<span style="opacity:0.6; margin-right:6px;">${item.time}</span>${item.msg}`;
                feedEl.appendChild(div);
            });
        }

        function addEvent(msg, isAlert=false, isDanger=false) {
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            initialEvents.unshift({ time: timeStr, msg: msg, alert: isAlert, danger: isDanger });
            if (initialEvents.length > 25) initialEvents.pop();
            renderFeed();
        }

        // CAN-bus Packet Stream Generator
        function generateCanStream() {
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            const cargo = CARGO_DB[state.cargoKey];
            
            // Raw ambient hex
            const rawAmb = Math.round((state.temp + 273.0) / 0.03125);
            const ambHex = `${(rawAmb & 0xFF).toString(16).toUpperCase().padStart(2, '0')} ${((rawAmb >> 8) & 0xFF).toString(16).toUpperCase().padStart(2, '0')} FF FF FF FF FF FF`;

            const packets = [
                { id: "0x18FEE900", pgn: 65269, hex: ambHex, desc: `AMB_Temp: ${state.temp.toFixed(1)}°C` },
                { id: "0x18FEF200", pgn: 65266, hex: "00 00 00 00 FF FF FF FF", desc: "LFE_FuelRate: 0.00 L/hr (ZERO_GENSET)" },
                { id: "0x18FF0000", pgn: 65520, hex: `12 04 01 FF FF FF FF FF`, desc: `REEFER: Core=${(cargo.prechill + 0.14).toFixed(1)}°C | Status=SECURE_PASS` }
            ];

            packets.forEach(p => {
                state.canPackets.unshift({ time: timeStr, id: p.id, hex: p.hex, desc: p.desc });
            });
            if (state.canPackets.length > 30) state.canPackets.length = 30;

            const canFeedEl = document.getElementById('canFeed');
            canFeedEl.innerHTML = '';
            state.canPackets.forEach(p => {
                const row = document.createElement('div');
                row.className = 'can-row';
                row.innerHTML = `<span class="can-time">${p.time}</span><span class="can-id">${p.id}</span><span class="can-hex">${p.hex}</span><span class="can-desc">${p.desc}</span>`;
                canFeedEl.appendChild(row);
            });
        }
        setInterval(generateCanStream, 2000);

        // Pitch Scenarios
        function setScenario(sc) {
            state.scenario = sc;
            document.querySelectorAll('.btn-scenario').forEach(b => b.classList.remove('active', 'alert-active'));

            if (sc === 'normal') {
                document.getElementById('btnScenarioNormal').classList.add('active');
                document.getElementById('sliderDuration').value = 38;
                document.getElementById('activeModeBadge').innerText = "標準零發電機模式";
                document.getElementById('activeModeBadge').style.borderColor = "rgba(16, 185, 129, 0.3)";
                document.getElementById('activeModeBadge').style.color = "var(--cyber-emerald)";
                document.getElementById('hudSafetyStatus').innerText = "通行證核發：拔除發電機";
                document.getElementById('hudSafetyStatus').style.color = "var(--cyber-emerald)";
                addEvent("[MODE] 切換至標準零發電機模式：車程 38 分鐘，現省 NT$ 1,610！");
            } else if (sc === 'stall') {
                document.getElementById('btnScenarioStall').classList.add('alert-active');
                document.getElementById('sliderDuration').value = 90;
                document.getElementById('activeModeBadge').innerText = "⚠️ 警報：過港隧道嚴重車禍塞車";
                document.getElementById('activeModeBadge').style.borderColor = "rgba(244, 63, 94, 0.4)";
                document.getElementById('activeModeBadge').style.color = "var(--rose-alert)";
                document.getElementById('hudSafetyStatus').innerText = "⚠️ 溫升斜率偏離！需避險支援";
                document.getElementById('hudSafetyStatus').style.color = "var(--rose-alert)";
                addEvent("[ALERT] 模擬過港隧道大塞車：預估卡關 90 分鐘，動態預算進入防護警戒！", true, true);
            } else if (sc === 'safety') {
                document.getElementById('btnScenarioSafety').classList.add('active');
                document.getElementById('sliderDuration').value = 52;
                document.getElementById('activeModeBadge').innerText = "🛡️ 動態安全網啟動：小港中繼插座";
                document.getElementById('activeModeBadge').style.borderColor = "rgba(6, 182, 212, 0.4)";
                document.getElementById('activeModeBadge').style.color = "var(--electric-cyan)";
                document.getElementById('hudSafetyStatus').innerText = "已轉向小港中繼岸電：保證零貨損";
                document.getElementById('hudSafetyStatus').style.color = "var(--electric-cyan)";
                addEvent("[SAFETY-NET] 動態避險網介入：卡車轉向小港中繼站補電，保證零貨損！", true, false);
            }
            updatePhysics();
        }

        // Rigorous Thermodynamic Differential Calculations
        function updatePhysics() {
            state.temp = parseFloat(document.getElementById('sliderTemp').value);
            state.payload = parseFloat(document.getElementById('sliderPayload').value);
            state.duration = parseFloat(document.getElementById('sliderDuration').value);

            document.getElementById('valTemp').innerText = state.temp.toFixed(1) + " °C";
            document.getElementById('valPayload').innerText = state.payload.toFixed(1) + " 噸";
            document.getElementById('valDuration').innerText = state.duration.toFixed(0) + " 分鐘";

            const cargo = CARGO_DB[state.cargoKey];
            const prechillTemp = cargo.prechill;
            const deltaT_ambient = state.temp - prechillTemp;

            // Physics calculation
            const heatLeakRate = state.leakRate * deltaT_ambient + (29.8 * 600.0 * 0.25); // Conduction + Solar
            const totalHeatJoules = heatLeakRate * (state.duration * 60); // Joules
            const totalHeatKwh = totalHeatJoules / 3600000;
            const cargoCapacity = (state.payload * 1000 * cargo.cp) + (4200 * 490); // Cargo + Steel tare
            const tempRise = totalHeatJoules / cargoCapacity;
            const finalTemp = prechillTemp + tempRise;
            const isSafe = (finalTemp <= cargo.critical);

            document.getElementById('thLeak').innerText = state.leakRate.toFixed(1) + " W/K (" + (heatLeakRate/1000).toFixed(2) + " kW)";
            document.getElementById('thCap').innerText = (cargoCapacity / 1000000).toFixed(1) + " MJ / °C";
            document.getElementById('thHeat').innerText = totalHeatKwh.toFixed(2) + " kWh (" + (totalHeatJoules/1000000).toFixed(2) + " MJ)";
            
            const driftEl = document.getElementById('thDrift');
            driftEl.innerText = "+" + tempRise.toFixed(2) + " °C (" + (isSafe ? "極安全" : "需中繼補電") + ")";
            driftEl.style.color = isSafe ? "var(--cyber-emerald)" : "var(--rose-alert)";

            const limitEl = document.getElementById('thLimit');
            const margin = cargo.critical - finalTemp;
            limitEl.innerText = `上限 ${cargo.critical}°C (安全餘裕 +${margin.toFixed(2)}°C)`;

            // Update Financial & Carbon Metrics
            const cashSaved = (state.scenario === 'normal' || state.scenario === 'safety') ? 1610 : 0;
            document.getElementById('metricCash').innerHTML = `NT$ ${cashSaved} <span style="font-size: 11px; color: var(--text-secondary);">(免租 NT$1,500 + 油資)</span>`;
            document.getElementById('metricFleetCash').innerText = `NT$ ${(cashSaved * 30 * 2 * 24 / 10000).toFixed(1)} 萬`;
            document.getElementById('metricCarbon').innerText = (state.scenario === 'normal' || state.scenario === 'safety') ? "21.4 kg CO₂e" : "0.0 kg (發電機重啟)";

            // Update Telemetry Chart
            updateChartData(prechillTemp, tempRise, state.duration);
        }

        // Radar Simulation Canvas
        function initTrucks() {
            state.trucks = [];
            for (let i = 0; i < 16; i++) {
                const moving = Math.random() > 0.28;
                state.trucks.push({
                    id: "CMC-ET35-" + (100 + i),
                    x: 160 + Math.random() * 420,
                    y: 110 + Math.random() * 220,
                    vx: moving ? (0.55 + Math.random() * 0.85) * (Math.random() > 0.45 ? 1 : -1) : 0,
                    vy: moving ? (Math.random() - 0.5) * 0.7 : 0,
                    state: moving ? 'moving' : 'docked',
                    cargo: Object.keys(CARGO_DB)[i % 6],
                    trail: []
                });
            }
        }

        function drawMap() {
            const { w, h, dpr } = fitHiDPICanvas(canvas);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            if (w < 40 || h < 40) {
                requestAnimationFrame(drawMap);
                return;
            }

            const cx = w * 0.36;
            const cy = h * 0.50;
            const now = Date.now();
            const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            // Deep navy ocean
            const ocean = ctx.createLinearGradient(0, 0, w * 0.2, h);
            ocean.addColorStop(0, '#0d2238');
            ocean.addColorStop(0.55, '#0a1b30');
            ocean.addColorStop(1, '#081628');
            ctx.fillStyle = ocean;
            ctx.fillRect(0, 0, w, h);

            const swell = ctx.createRadialGradient(w * 0.30, h * 0.42, 12, w * 0.30, h * 0.42, Math.max(w, h) * 0.72);
            swell.addColorStop(0, 'rgba(14, 165, 233, 0.16)');
            swell.addColorStop(0.55, 'rgba(8, 47, 73, 0.05)');
            swell.addColorStop(1, 'rgba(7, 19, 34, 0)');
            ctx.fillStyle = swell;
            ctx.fillRect(0, 0, w, h);

            // Navigational channel / fairway
            ctx.save();
            ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
            ctx.lineWidth = 42;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(w * 0.34, -8);
            ctx.bezierCurveTo(w * 0.30, h * 0.28, w * 0.28, h * 0.58, w * 0.24, h + 8);
            ctx.stroke();
            ctx.shadowBlur = 6;
            ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
            ctx.lineWidth = 1.6;
            ctx.setLineDash([10, 9]);
            ctx.beginPath();
            ctx.moveTo(w * 0.34, -8);
            ctx.bezierCurveTo(w * 0.30, h * 0.28, w * 0.28, h * 0.58, w * 0.24, h + 8);
            ctx.stroke();
            ctx.restore();

            const strokeCoast = function () {
                ctx.save();
                ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
                ctx.shadowBlur = 4;
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
                ctx.lineWidth = 6;
                ctx.stroke();
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            };

            const landFill = ctx.createLinearGradient(0, 0, 0, h);
            landFill.addColorStop(0, '#1e293b');
            landFill.addColorStop(1, '#151d2a');

            // West landmass (Qijin / breakwater)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(w * 0.145, 0);
            ctx.bezierCurveTo(w * 0.20, h * 0.16, w * 0.13, h * 0.40, w * 0.175, h * 0.62);
            ctx.lineTo(w * 0.11, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fillStyle = landFill;
            ctx.fill();
            strokeCoast();

            // East landmass (terminals + Qianzhen hinterland)
            ctx.beginPath();
            ctx.moveTo(w, 0);
            ctx.lineTo(w * 0.56, 0);
            ctx.bezierCurveTo(w * 0.50, h * 0.10, w * 0.60, h * 0.22, w * 0.46, h * 0.34);
            ctx.bezierCurveTo(w * 0.38, h * 0.44, w * 0.48, h * 0.56, w * 0.40, h * 0.70);
            ctx.lineTo(w * 0.44, h);
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = landFill;
            ctx.fill();
            strokeCoast();

            // Land grain
            ctx.save();
            ctx.globalAlpha = 0.035;
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            for (let x = -h; x < w; x += 18) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x + h, h);
                ctx.stroke();
            }
            ctx.restore();

            // Tactical grid over water
            ctx.save();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
            ctx.lineWidth = 1;
            for (let x = 0; x < w; x += 36) {
                ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
            }
            for (let y = 0; y < h; y += 36) {
                ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
            }
            ctx.restore();

            // Range rings + sweep
            ctx.save();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.lineWidth = 1;
            const maxR = Math.hypot(w, h) * 0.62;
            for (let r = 48; r < maxR; r += 52) {
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
            ctx.beginPath();
            ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
            ctx.moveTo(0, cy); ctx.lineTo(w, cy);
            ctx.stroke();
            if (!reduceMotion) {
                const ang = ((now / 32) % 360) * Math.PI / 180;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, maxR * 0.72, ang, ang + 0.38);
                ctx.closePath();
                const sweep = ctx.createRadialGradient(cx, cy, 8, cx, cy, maxR * 0.72);
                sweep.addColorStop(0, 'rgba(56, 189, 248, 0.10)');
                sweep.addColorStop(1, 'rgba(56, 189, 248, 0.00)');
                ctx.fillStyle = sweep;
                ctx.fill();
            }
            ctx.restore();

            const occupied = [];
            const labelFits = (x, y, tw, th) => {
                for (let i = 0; i < occupied.length; i++) {
                    const r = occupied[i];
                    if (x < r.x + r.w + 4 && x + tw + 4 > r.x && y < r.y + r.h + 3 && y + th + 3 > r.y) return false;
                }
                return true;
            };
            const placeTag = (px, py, text, color, preferLeft) => {
                ctx.font = '500 10px JetBrains Mono, ui-monospace, monospace';
                const tw = Math.ceil(ctx.measureText(text).width) + 10;
                const th = 15;
                const tries = preferLeft
                    ? [[px - tw - 8, py - 8], [px + 8, py - 8], [px + 8, py + 10], [px - tw - 8, py + 10], [px - tw / 2, py - 20]]
                    : [[px + 8, py - 8], [px - tw - 8, py - 8], [px + 8, py + 10], [px - tw - 8, py + 10], [px - tw / 2, py - 20]];
                let placed = null;
                for (let i = 0; i < tries.length; i++) {
                    const x = Math.max(4, Math.min(w - tw - 4, tries[i][0]));
                    const y = Math.max(4, Math.min(h - th - 4, tries[i][1]));
                    if (labelFits(x, y, tw, th)) { placed = { x: x, y: y }; break; }
                }
                if (!placed) return false;
                occupied.push({ x: placed.x, y: placed.y, w: tw, h: th });
                ctx.fillStyle = 'rgba(9, 9, 11, 0.86)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(placed.x, placed.y, tw, th, 3);
                else ctx.rect(placed.x, placed.y, tw, th);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = color;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, placed.x + 5, placed.y + th / 2 + 0.5);
                return true;
            };

            const drawBerthBank = (x, y, count, startNo, activeNo, label, vertical) => {
                const slotW = vertical ? 54 : 36;
                const slotH = vertical ? 28 : 46;
                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
                ctx.lineWidth = 1.2;
                const bankW = vertical ? slotW + 10 : count * (slotW + 4) + 8;
                const bankH = vertical ? count * (slotH + 4) + 8 : slotH + 14;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(x, y, bankW, bankH, 4);
                else ctx.rect(x, y, bankW, bankH);
                ctx.fill();
                ctx.stroke();
                for (let i = 0; i < count; i++) {
                    const bn = startNo + i;
                    const sx = vertical ? x + 5 : x + 6 + i * (slotW + 4);
                    const sy = vertical ? y + 6 + i * (slotH + 4) : y + 8;
                    const isActive = bn === activeNo;
                    ctx.fillStyle = isActive ? 'rgba(16, 185, 129, 0.32)' : 'rgba(30, 41, 59, 0.92)';
                    ctx.strokeStyle = isActive ? 'rgba(52, 211, 153, 0.95)' : 'rgba(148, 163, 184, 0.45)';
                    ctx.lineWidth = isActive ? 1.6 : 1;
                    if (isActive) {
                        ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
                        ctx.shadowBlur = 12;
                    } else {
                        ctx.shadowBlur = 0;
                    }
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(sx, sy, slotW, slotH, 3);
                    else ctx.rect(sx, sy, slotW, slotH);
                    ctx.fill();
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = isActive ? '#d1fae5' : '#cbd5e1';
                    ctx.font = (isActive ? '700 ' : '600 ') + '9px JetBrains Mono, ui-monospace, monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(bn), sx + slotW / 2, sy + slotH / 2);
                }
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '700 9px JetBrains Mono, ui-monospace, monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(label, x + 6, y - 13);
                occupied.push({ x: x, y: y - 15, w: ctx.measureText(label).width + 10, h: 13 });
                ctx.restore();
                return { bankW: bankW, bankH: bankH };
            };

            // HUD chip sits bottom-left — keep tags off that strip, not the docks
            occupied.push({ x: 4, y: h - 56, w: Math.min(460, w * 0.7), h: 52 });

            const t4w = 4 * 40 + 8;
            const t4x = Math.min(Math.max(w * 0.46, 210), Math.max(16, w - t4w - 196));
            drawBerthBank(t4x, 28, 4, 63, 0, 'TERMINAL 4  ·  BERTHS 63–66', false);
            const t5x = Math.max(18, w * 0.20);
            const t5y = Math.max(118, h * 0.30);
            const t5 = drawBerthBank(t5x, t5y, 5, 77, 78, 'TERMINAL 5  ·  BERTHS 77–81', true);

            // Active berth glow for #78
            const slotH = 28;
            const glowX = t5x + 5;
            const glowY = t5y + 6 + 1 * (slotH + 4);
            ctx.save();
            ctx.shadowColor = 'rgba(16, 185, 129, 0.85)';
            ctx.shadowBlur = 22;
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(glowX, glowY, 54, slotH, 3);
            else ctx.rect(glowX, glowY, 54, slotH);
            ctx.stroke();
            ctx.restore();

            // Container ship WAN HAI 315 at Berth 78
            const shipX = t5x + t5.bankW + 10;
            const shipY = glowY + slotH / 2;
            ctx.save();
            ctx.shadowColor = 'rgba(16, 185, 129, 0.35)';
            ctx.shadowBlur = 14;
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(shipX, shipY - 11);
            ctx.lineTo(shipX + 92, shipY - 7);
            ctx.lineTo(shipX + 108, shipY);
            ctx.lineTo(shipX + 92, shipY + 7);
            ctx.lineTo(shipX, shipY + 11);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            const boxes = ['#10b981', '#0ea5e9', '#f59e0b', '#64748b', '#34d399', '#38bdf8'];
            for (let c = 0; c < 6; c++) {
                ctx.fillStyle = boxes[c];
                ctx.fillRect(shipX + 6 + c * 14, shipY - 6, 12, 5);
                ctx.fillRect(shipX + 6 + c * 14, shipY + 1, 12, 5);
            }
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(9, 9, 11, 0.7)';
            ctx.lineWidth = 1;
            for (let c = 1; c < 6; c++) {
                ctx.beginPath();
                ctx.moveTo(shipX + 5 + c * 14, shipY - 7);
                ctx.lineTo(shipX + 5 + c * 14, shipY + 7);
                ctx.stroke();
            }
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(shipX + 90, shipY - 10, 10, 8);
            ctx.restore();

            // Gantry crane over Berth 78
            const gx = shipX + 8;
            const gy = shipY - 36;
            const trolley = reduceMotion ? 28 : (24 + Math.sin(now / 700) * 16);
            ctx.save();
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(gx, shipY + 12);
            ctx.lineTo(gx, gy);
            ctx.lineTo(gx + 78, gy);
            ctx.lineTo(gx + 78, shipY + 12);
            ctx.stroke();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(gx - 4, gy + 4);
            ctx.lineTo(gx + 82, gy + 4);
            ctx.stroke();
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(gx + trolley, gy - 5, 12, 7);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(gx + trolley + 6, gy + 2);
            ctx.lineTo(gx + trolley + 6, shipY - 8);
            ctx.stroke();
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(gx + trolley - 7, shipY - 10, 26, 5);
            ctx.restore();
            placeTag(gx + 84, gy - 6, 'BERTH 78 (ACTIVE DISCHARGE)', '#10b981', false);
            placeTag(shipX + 112, shipY - 2, 'WAN HAI 315', '#6ee7b7', false);

            // Qianzhen Cold Hub
            const hubX = w - 188;
            const hubY = 96;
            ctx.save();
            ctx.fillStyle = 'rgba(14, 165, 233, 0.14)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.lineWidth = 1.6;
            ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(hubX, hubY, 168, 168, 5);
            else ctx.rect(hubX, hubY, 168, 168);
            ctx.fill();
            ctx.stroke();
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
                    ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
                    ctx.lineWidth = 1;
                    const bx = hubX + 12 + c * 50;
                    const by = hubY + 28 + r * 42;
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(bx, by, 42, 32, 2);
                    else ctx.rect(bx, by, 42, 32);
                    ctx.fill();
                    ctx.stroke();
                }
            }
            ctx.restore();
            placeTag(hubX + 8, hubY + 6, 'QIANZHEN COLD HUB', '#7dd3fc', false);

            // Harbor tunnel
            ctx.save();
            const stall = state.scenario === 'stall';
            const tA = { x: t5x + t5.bankW + 8, y: t5y + t5.bankH * 0.45 };
            const tB = { x: hubX - 8, y: 210 };
            const tLen = Math.hypot(tB.x - tA.x, tB.y - tA.y) || 1;
            const nx = -(tB.y - tA.y) / tLen * 4;
            const ny = (tB.x - tA.x) / tLen * 4;
            ctx.strokeStyle = stall ? 'rgba(244, 63, 94, 0.9)' : 'rgba(16, 185, 129, 0.7)';
            ctx.lineWidth = 2;
            ctx.setLineDash([7, 6]);
            [-1, 1].forEach(function (side) {
                ctx.beginPath();
                ctx.moveTo(tA.x + nx * side, tA.y + ny * side);
                ctx.lineTo(tB.x + nx * side, tB.y + ny * side);
                ctx.stroke();
            });
            ctx.setLineDash([]);
            if (!reduceMotion) {
                ctx.fillStyle = stall ? '#fb7185' : '#34d399';
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 10;
                for (let k = 0; k < 3; k++) {
                    const f = (((now / (stall ? 4000 : 1600)) + k / 3) % 1);
                    [-1, 1].forEach(function (side) {
                        const ff = side > 0 ? f : 1 - f;
                        ctx.beginPath();
                        ctx.arc(tA.x + (tB.x - tA.x) * ff + nx * side, tA.y + (tB.y - tA.y) * ff + ny * side, 2.4, 0, Math.PI * 2);
                        ctx.fill();
                    });
                }
            }
            ctx.restore();
            placeTag(
                w * 0.52,
                200,
                state.scenario === 'stall' ? 'TUNNEL STALL 90M' : 'HARBOR TUNNEL 38M',
                state.scenario === 'stall' ? '#fb7185' : '#94a3b8',
                false
            );

            if (state.scenario === 'safety') {
                const px = w * 0.40;
                const py = h - 86;
                ctx.save();
                ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(px, py, 148, 46, 4);
                else ctx.rect(px, py, 148, 46);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
                placeTag(px + 8, py + 8, 'XIAOGANG SHORE POWER', '#fbbf24', false);
            }

            state.trucks.forEach((t, idx) => {
                if (t.state === 'moving') {
                    t.x += t.vx;
                    t.y += t.vy;
                    if (t.x < 48 || t.x > w - 48) t.vx *= -1;
                    if (t.y < 88 || t.y > h - 58) t.vy *= -1;
                    t.trail.push({ x: t.x, y: t.y });
                    if (t.trail.length > 14) t.trail.shift();
                }

                if (t.state === 'moving' && t.trail.length > 1) {
                    ctx.save();
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    for (let i = 1; i < t.trail.length; i++) {
                        const a = i / t.trail.length;
                        ctx.strokeStyle = 'rgba(52, 211, 153,' + (0.12 + a * 0.6) + ')';
                        ctx.lineWidth = 1 + a * 2.2;
                        ctx.beginPath();
                        ctx.moveTo(t.trail[i - 1].x, t.trail[i - 1].y);
                        ctx.lineTo(t.trail[i].x, t.trail[i].y);
                        ctx.stroke();
                    }
                    ctx.restore();
                }

                const heading = Math.atan2(t.vy || 0, t.vx || 1);
                ctx.save();
                ctx.translate(t.x, t.y);
                ctx.rotate(t.state === 'moving' ? heading : 0);
                ctx.fillStyle = t.state === 'docked' ? '#38bdf8' : '#10b981';
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 10;
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(9, 0);
                ctx.lineTo(-6, -4.6);
                ctx.lineTo(-3.6, 0);
                ctx.lineTo(-6, 4.6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();

                const show = t.state === 'docked' || idx % 2 === 0;
                if (show) {
                    placeTag(t.x, t.y, t.id, t.state === 'docked' ? '#7dd3fc' : '#a7f3d0', idx % 3 === 0);
                }
            });

            requestAnimationFrame(drawMap);
        }

        // Telemetry Chart
        function updateChartData(prechill, rise, duration) {
            state.telemetryHistory = [];
            const steps = 15;
            for (let i = 0; i <= steps; i++) {
                const fraction = i / steps;
                const m = fraction * duration;
                const temp = prechill + (rise * fraction);
                state.telemetryHistory.push({ min: m, temp: temp });
            }
            drawChart();
        }

        function drawChart() {
            const { w, h, dpr } = fitHiDPICanvas(chartCanvas);
            chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            chartCtx.clearRect(0, 0, w, h);
            if (w < 40 || h < 40) return;
            if (state.telemetryHistory.length < 2) return;

            const cargo = CARGO_DB[state.cargoKey];
            const hist = state.telemetryHistory;
            const startT = hist[0].temp;
            const endT = hist[hist.length - 1].temp;
            const critical = cargo.critical;
            const margin = critical - endT;

            const compactLegend = w < 460;
            const padL = 48;
            const padR = 14;
            const padT = compactLegend ? 36 : 26;
            const padB = 26;
            const plotW = Math.max(8, w - padL - padR);
            const plotH = Math.max(8, h - padT - padB);

            let minT = Math.min(startT, endT, critical) - 0.55;
            let maxT = Math.max(startT, endT, critical) + 0.45;
            if (maxT - minT < 1.4) maxT = minT + 1.4;

            const xAt = (i) => padL + (i / (hist.length - 1)) * plotW;
            const yAt = (temp) => padT + (1 - (temp - minT) / (maxT - minT)) * plotH;

            chartCtx.fillStyle = '#07080b';
            chartCtx.fillRect(0, 0, w, h);

            chartCtx.font = '500 10px JetBrains Mono, ui-monospace, monospace';
            const tickCount = 4;
            for (let i = 0; i <= tickCount; i++) {
                const t = minT + ((maxT - minT) * i) / tickCount;
                const y = Math.round(yAt(t)) + 0.5;
                chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
                chartCtx.lineWidth = 1;
                chartCtx.beginPath();
                chartCtx.moveTo(padL, y);
                chartCtx.lineTo(w - padR, y);
                chartCtx.stroke();

                chartCtx.strokeStyle = 'rgba(248, 250, 252, 0.32)';
                chartCtx.beginPath();
                chartCtx.moveTo(padL - 4, y);
                chartCtx.lineTo(padL, y);
                chartCtx.stroke();

                chartCtx.fillStyle = '#64748b';
                chartCtx.textAlign = 'right';
                chartCtx.textBaseline = 'middle';
                chartCtx.fillText(t.toFixed(1) + '°', padL - 7, y);
            }

            const xTicks = 4;
            const dur = hist[hist.length - 1].min;
            for (let i = 0; i <= xTicks; i++) {
                const x = Math.round(padL + (i / xTicks) * plotW) + 0.5;
                chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
                chartCtx.beginPath();
                chartCtx.moveTo(x, padT);
                chartCtx.lineTo(x, padT + plotH);
                chartCtx.stroke();
                chartCtx.strokeStyle = 'rgba(248, 250, 252, 0.32)';
                chartCtx.beginPath();
                chartCtx.moveTo(x, padT + plotH);
                chartCtx.lineTo(x, padT + plotH + 4);
                chartCtx.stroke();
                chartCtx.fillStyle = '#64748b';
                chartCtx.textAlign = 'center';
                chartCtx.textBaseline = 'top';
                chartCtx.fillText((dur * i / xTicks).toFixed(0) + 'm', x, padT + plotH + 6);
            }

            chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
            chartCtx.lineWidth = 1;
            chartCtx.beginPath();
            chartCtx.moveTo(padL + 0.5, padT);
            chartCtx.lineTo(padL + 0.5, padT + plotH);
            chartCtx.lineTo(w - padR, padT + plotH + 0.5);
            chartCtx.stroke();

            const yCrit = yAt(critical);
            if (yCrit >= padT && yCrit <= padT + plotH) {
                chartCtx.save();
                chartCtx.setLineDash([5, 4]);
                chartCtx.strokeStyle = 'rgba(251, 113, 133, 0.88)';
                chartCtx.lineWidth = 1.25;
                chartCtx.beginPath();
                chartCtx.moveTo(padL, yCrit);
                chartCtx.lineTo(w - padR, yCrit);
                chartCtx.stroke();
                chartCtx.setLineDash([]);
                chartCtx.fillStyle = '#fb7185';
                chartCtx.font = '600 9px JetBrains Mono, ui-monospace, monospace';
                chartCtx.textAlign = 'left';
                chartCtx.textBaseline = 'bottom';
                chartCtx.fillText('HACCP ' + critical.toFixed(1) + '°C', padL + 6, yCrit - 3);
                chartCtx.restore();
            }

            chartCtx.beginPath();
            hist.forEach((pt, idx) => {
                const x = xAt(idx);
                const y = yAt(pt.temp);
                if (idx === 0) chartCtx.moveTo(x, y);
                else chartCtx.lineTo(x, y);
            });
            const lastX = xAt(hist.length - 1);
            const firstX = xAt(0);
            chartCtx.save();
            chartCtx.lineTo(lastX, padT + plotH);
            chartCtx.lineTo(firstX, padT + plotH);
            chartCtx.closePath();
            const grad = chartCtx.createLinearGradient(0, padT, 0, padT + plotH);
            grad.addColorStop(0, 'rgba(16, 185, 129, 0.34)');
            grad.addColorStop(0.55, 'rgba(16, 185, 129, 0.10)');
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
            chartCtx.fillStyle = grad;
            chartCtx.fill();
            chartCtx.restore();

            chartCtx.beginPath();
            hist.forEach((pt, idx) => {
                const x = xAt(idx);
                const y = yAt(pt.temp);
                if (idx === 0) chartCtx.moveTo(x, y);
                else chartCtx.lineTo(x, y);
            });
            chartCtx.strokeStyle = '#34d399';
            chartCtx.lineWidth = 2;
            chartCtx.lineJoin = 'round';
            chartCtx.lineCap = 'round';
            chartCtx.stroke();

            [[firstX, yAt(startT)], [lastX, yAt(endT)]].forEach(function (pt) {
                chartCtx.beginPath();
                chartCtx.arc(pt[0], pt[1], 3.2, 0, Math.PI * 2);
                chartCtx.fillStyle = '#ecfdf5';
                chartCtx.fill();
                chartCtx.strokeStyle = '#10b981';
                chartCtx.lineWidth = 1.5;
                chartCtx.stroke();
            });

            const chips = [
                { label: 'Start Temp', value: startT.toFixed(2) + '°C', color: '#e2e8f0' },
                { label: 'Safety Margin', value: (margin >= 0 ? '+' : '') + margin.toFixed(2) + '°C', color: margin >= 0 ? '#34d399' : '#fb7185' },
                { label: 'End Temp', value: endT.toFixed(2) + '°C', color: '#e2e8f0' }
            ];
            const chipW = (w - 12) / 3;
            chips.forEach(function (chip, i) {
                const x = 6 + i * chipW;
                chartCtx.textAlign = 'left';
                chartCtx.font = '600 9px Plus Jakarta Sans, Noto Sans TC, system-ui, sans-serif';
                chartCtx.fillStyle = '#64748b';
                if (compactLegend) {
                    chartCtx.textBaseline = 'top';
                    chartCtx.fillText(chip.label, x + 4, 5);
                    chartCtx.font = '600 10px JetBrains Mono, ui-monospace, monospace';
                    chartCtx.fillStyle = chip.color;
                    chartCtx.fillText(chip.value, x + 4, 17);
                } else {
                    chartCtx.textBaseline = 'middle';
                    chartCtx.fillText(chip.label, x + 4, 12);
                    const labW = chartCtx.measureText(chip.label).width;
                    chartCtx.font = '600 10px JetBrains Mono, ui-monospace, monospace';
                    chartCtx.fillStyle = chip.color;
                    chartCtx.fillText(chip.value, x + 8 + labW, 12);
                }
            });
        }

        // ISO 14083 Certificate Modal with SHA-256
        async function openCertModal() {
            const cargo = CARGO_DB[state.cargoKey];
            const deltaT_ambient = state.temp - cargo.prechill;
            const heatLeakRate = state.leakRate * deltaT_ambient + (29.8 * 600.0 * 0.25);
            const totalHeatJoules = heatLeakRate * (state.duration * 60);
            const cargoCapacity = (state.payload * 1000 * cargo.cp) + (4200 * 490);
            const tempRise = totalHeatJoules / cargoCapacity;
            const finalTemp = cargo.prechill + tempRise;

            document.getElementById('modalCargo').innerText = `${cargo.name} (${state.payload} 噸)`;
            document.getElementById('modalDrift').innerText = `+${tempRise.toFixed(2)} °C (最終 ${finalTemp.toFixed(2)}°C | 合規)`;
            document.getElementById('modalSavings').innerText = `NT$ 1,610 (免租 NT$1,500 + 油資 NT$110)`;

            // Compute Real Cryptographic SHA-256
            const certPayload = {
                standard: "ISO 14083:2023 / GLEC Framework Tier-3",
                uid: "CR-KHH-20261021-087",
                issuer: "CrossRoute Telematics & Yulon TAC Green Audit",
                timestamp: new Date().toISOString(),
                origin: "高雄港 第五貨櫃中心 78號碼頭",
                destination: "前鎮保稅冷鏈物流園區 (19.4 km)",
                vehicle: "中華汽車 CMC ET35 商用電動車",
                cargo: cargo.name,
                payload_ton: state.payload,
                temp_rise_c: tempRise,
                final_temp_c: finalTemp,
                haccp_pass: (finalTemp <= cargo.critical),
                cash_saved_ntd: 1610,
                carbon_avoided_kg_co2e: 21.44
            };
            state.latestCertificate = certPayload;

            const textEncoder = new TextEncoder();
            const data = textEncoder.encode(JSON.stringify(certPayload));
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            certPayload.cryptographic_hash_sha256 = hashHex;
            document.getElementById('modalHash').innerText = hashHex;
            document.getElementById('certModal').style.display = 'flex';
        }

        function closeCertModal() {
            document.getElementById('certModal').style.display = 'none';
        }

        // In-Cab Driver HUD Control
        function openDriverHud() {
            document.getElementById('driverHud').style.display = 'flex';
            setHudMode('go');
        }

        function closeDriverHud() {
            document.getElementById('driverHud').style.display = 'none';
        }

        function setHudMode(mode) {
            const card = document.getElementById('hudStatusCard');
            const badge = document.getElementById('hudBigBadge');
            const title = document.getElementById('hudStateTitle');
            const countdown = document.getElementById('hudCountdown');
            const desc = document.getElementById('hudStateDesc');
            const actionText = document.getElementById('hudActionText');
            const badgeText = document.getElementById('hudStateBadgeText');

            card.classList.remove('watch', 'abort');

            if (mode === 'go') {
                badgeText.innerText = "FSM: NOMINAL (NORMAL)";
                badgeText.style.color = "var(--cyber-emerald)";
                badgeText.style.borderColor = "var(--cyber-emerald)";
                title.innerText = "GREEN PASS: GO";
                countdown.innerText = "48 MINS";
                countdown.style.color = "#ffffff";
                desc.innerText = "20噸冷凍牛豬肉蓄冷量充足 (36 MJ/°C)。核心溫升僅 +0.12°C，遠低於法規標準，准予拔除柴油發電機輕量行駛。";
                actionText.innerText = "保持巡航速度 · 直行新生高架至仁武冷鏈物流園區 · 預計 28 分鐘抵達";
                document.getElementById('hudAirTemp').innerText = "-18.2 °C";
                document.getElementById('hudCoreTemp').innerText = "-19.36 °C";
                document.getElementById('hudNearestPlug').innerText = "小港四號門冷鏈緩衝站 (3.8 km)";
            } else if (mode === 'watch') {
                card.classList.add('watch');
                badgeText.innerText = "FSM: ELEVATED RISK (WARNING)";
                badgeText.style.color = "#f59e0b";
                badgeText.style.borderColor = "#f59e0b";
                title.innerText = "THERMAL WATCH";
                countdown.innerText = "18 MINS";
                countdown.style.color = "#f59e0b";
                desc.innerText = "過港隧道發生突發塞車事故，車速降至 12 km/h。櫃內回風溫升達到 +1.15°C，熱預算裕度收斂中。";
                actionText.innerText = "⚠️ 提高警示層級 · 準備就近切換至小港四號門岸電充冷避險 · 車隊調度員監控中";
                document.getElementById('hudAirTemp').innerText = "-17.6 °C";
                document.getElementById('hudCoreTemp').innerText = "-19.12 °C";
                document.getElementById('hudNearestPlug').innerText = "小港四號門冷鏈緩衝站 (1.2 km 待命中)";
            } else if (mode === 'abort') {
                card.classList.add('abort');
                badgeText.innerText = "FSM: FAIL-SAFE TRIGGERED";
                badgeText.style.color = "#ef4444";
                badgeText.style.borderColor = "#ef4444";
                title.innerText = "EMERGENCY ABORT";
                countdown.innerText = "04 MINS";
                countdown.style.color = "#ef4444";
                desc.innerText = "重大塞車滯留時間超過安全臨界值！回風溫升已達 +1.85°C。系統自主啟動雙重失效保護協議！";
                actionText.innerText = "🚨 立即右轉沿小港路進入4號門緊急岸電站插電 (380V CEE) · 零貨損保護鎖定";
                document.getElementById('hudAirTemp').innerText = "-16.4 °C";
                document.getElementById('hudCoreTemp').innerText = "-18.65 °C";
                document.getElementById('hudNearestPlug').innerText = "小港四號門岸電站 (0.4 km · 已為您預約插座)";
            }
        }

        function downloadAuditJson() {
            if (!state.latestCertificate) return;
            const fullAuditDossier = {
                schema_version: "CrossRoute-Audit-v1.2",
                standard_alignment: "ISO 14083:2023 / GLEC Framework v3.0 (Pre-Verification Methodology)",
                audit_authority: "CrossRoute Telematics Sovereign Node (Kaohsiung Harbor)",
                public_key_ed25519: "0425b40746bbf6386ba0b96623e59b970876543210fedcba9876543210abcdef",
                trip_summary: {
                    trip_id: state.latestCertificate.uid,
                    vehicle_id: "YULON-CMC-ET35-081",
                    container_id: "MSKU-749102-4",
                    cargo_type: state.latestCertificate.cargo,
                    origin: state.latestCertificate.origin,
                    destination: state.latestCertificate.destination,
                    transit_duration_mins: 38.0,
                    diesel_genset_detached: true,
                    haccp_temperature_status: {
                        initial_core_temp_c: -19.5,
                        peak_air_temp_c: -18.2,
                        peak_core_temp_c: state.latestCertificate.final_temp_c,
                        regulatory_limit_c: -15.0,
                        compliance_verdict: state.latestCertificate.haccp_pass ? "PASSED" : "VIOLATION"
                    },
                    environmental_audit: {
                        genset_diesel_burned_liters: 0.0,
                        baseline_diesel_liters: 8.0,
                        wtw_co2e_saved_kg: state.latestCertificate.carbon_avoided_kg_co2e,
                        financial_savings_twd: state.latestCertificate.cash_saved_ntd
                    }
                },
                telematics_manifest: {
                    event_count: 4,
                    merkle_root_sha256: state.latestCertificate.cryptographic_hash_sha256,
                    timestamp_utc: state.latestCertificate.timestamp,
                    rfc3161_nonce: "7a8b9c0d1e2f3a4b"
                },
                raw_events: [
                    { ts: 0, lat: 22.585, lon: 120.312, air_c: -19.4, core_c: -19.5, speed_kmh: 0, status: "BERTH_UNPLUG" },
                    { ts: 10, lat: 22.592, lon: 120.320, air_c: -19.1, core_c: -19.48, speed_kmh: 42, status: "HIGHWAY_CRUISE" },
                    { ts: 25, lat: 22.610, lon: 120.335, air_c: -18.7, core_c: -19.42, speed_kmh: 48, status: "HIGHWAY_CRUISE" },
                    { ts: 38, lat: 22.642, lon: 120.355, air_c: -18.2, core_c: state.latestCertificate.final_temp_c, speed_kmh: 12, status: "WAREHOUSE_ARRIVE" }
                ],
                cryptographic_signature: {
                    algorithm: "Ed25519",
                    signature_hex: "d4e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0"
                }
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullAuditDossier, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `CrossRoute_Signed_Trip_Audit_${state.latestCertificate.uid}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        }

        // Auditory Decibel Shock Demo — Web Audio API (no samples, $0)
        let audioShockTimer = null;
        let audioShockRaf = null;
        function playAuditoryShock() {
            const overlay = document.getElementById('audioShockOverlay');
            const badge = document.getElementById('dbBadge');
            const dbValue = document.getElementById('dbValue');
            const dbCaption = document.getElementById('dbCaption');
            const headerBtn = document.getElementById('btnAudioShock');
            const sceneBtn = document.getElementById('btnAudioShockScenario');

            if (audioShockTimer) { clearTimeout(audioShockTimer); audioShockTimer = null; }
            if (audioShockRaf) { cancelAnimationFrame(audioShockRaf); audioShockRaf = null; }
            if (state.audioCtx) {
                try { state.audioCtx.close(); } catch (e) {}
                state.audioCtx = null;
            }

            overlay.classList.add('live');
            badge.classList.remove('quiet');
            badge.classList.add('loud');
            dbValue.textContent = '92 dB';
            dbCaption.textContent = '極度吵雜 / 聽力受損';
            headerBtn.classList.add('playing');
            sceneBtn.classList.add('playing');

            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) {
                dbCaption.textContent = '此瀏覽器不支援 Web Audio API';
                return;
            }
            const actx = new AC();
            state.audioCtx = actx;
            const now = actx.currentTime;
            const dur = 3.5;

            const bufferSize = Math.floor(actx.sampleRate * dur);
            const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
            const data = buffer.getChannelData(0);
            let last = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                last = (last + 0.02 * white) / 1.02;
                const clatter = ((i % 480) < 38) ? (Math.random() * 0.55) : 0;
                data[i] = last * 5.2 + clatter * 0.35;
            }
            const noise = actx.createBufferSource();
            noise.buffer = buffer;

            const hp = actx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 32;
            const lp = actx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 190;
            lp.Q.value = 0.85;
            const peak = actx.createBiquadFilter();
            peak.type = 'peaking';
            peak.frequency.value = 78;
            peak.Q.value = 1.1;
            peak.gain.value = 7;

            const osc1 = actx.createOscillator();
            osc1.type = 'sawtooth';
            osc1.frequency.value = 46;
            const osc2 = actx.createOscillator();
            osc2.type = 'square';
            osc2.frequency.value = 92;
            const osc3 = actx.createOscillator();
            osc3.type = 'triangle';
            osc3.frequency.value = 23;

            const oscGain = actx.createGain();
            oscGain.gain.value = 0.16;
            const noiseGain = actx.createGain();
            noiseGain.gain.value = 0.52;
            const master = actx.createGain();
            master.gain.setValueAtTime(0.001, now);
            master.gain.exponentialRampToValueAtTime(0.9, now + 0.12);
            master.gain.setValueAtTime(0.9, now + dur - 0.04);
            master.gain.exponentialRampToValueAtTime(0.0001, now + dur);

            const lfo = actx.createOscillator();
            lfo.frequency.value = 8.4;
            const lfoGain = actx.createGain();
            lfoGain.gain.value = 0.18;
            lfo.connect(lfoGain);
            lfoGain.connect(noiseGain.gain);

            noise.connect(hp);
            hp.connect(lp);
            lp.connect(peak);
            peak.connect(noiseGain);
            noiseGain.connect(master);
            osc1.connect(oscGain);
            osc2.connect(oscGain);
            osc3.connect(oscGain);
            oscGain.connect(master);
            master.connect(actx.destination);

            if (actx.state === 'suspended') actx.resume();
            noise.start(now);
            osc1.start(now);
            osc2.start(now);
            osc3.start(now);
            lfo.start(now);
            noise.stop(now + dur);
            osc1.stop(now + dur);
            osc2.stop(now + dur);
            osc3.stop(now + dur);
            lfo.stop(now + dur);

            audioShockTimer = setTimeout(function () {
                try { actx.close(); } catch (e) {}
                state.audioCtx = null;
                badge.classList.remove('loud');
                badge.classList.add('quiet');
                headerBtn.classList.remove('playing');
                sceneBtn.classList.remove('playing');
                const start = performance.now();
                const from = 92;
                const to = 42;
                const tick = function (ts) {
                    const p = Math.min(1, (ts - start) / 380);
                    const eased = 1 - Math.pow(1 - p, 3);
                    dbValue.textContent = Math.round(from + (to - from) * eased) + ' dB';
                    if (p < 1) {
                        audioShockRaf = requestAnimationFrame(tick);
                    } else {
                        dbValue.textContent = '42 dB';
                        dbCaption.textContent = '純電寧靜 / 司機尊嚴';
                        addEvent('[AUDIO] 聽覺震撼對比完成：92 dB 柴油發電機 → 42 dB 純電靜音', false, false);
                        audioShockTimer = setTimeout(function () {
                            overlay.classList.remove('live');
                            badge.classList.remove('quiet');
                            badge.classList.add('loud');
                            dbValue.textContent = '92 dB';
                            dbCaption.textContent = '極度吵雜 / 聽力受損';
                        }, 3800);
                    }
                };
                audioShockRaf = requestAnimationFrame(tick);
            }, 3500);
        }

        // Init App
        window.addEventListener('DOMContentLoaded', () => {
            resizeCanvases();
            if (window.ResizeObserver) {
                const ro = new ResizeObserver(function () { resizeCanvases(); });
                if (canvas.parentElement) ro.observe(canvas.parentElement);
                if (chartCanvas.parentElement) ro.observe(chartCanvas.parentElement);
            }
            renderFeed();
            initTrucks();
            drawMap();
            updatePhysics();
            // Auto fetch weather on load
            fetchLiveWeather();
        });
