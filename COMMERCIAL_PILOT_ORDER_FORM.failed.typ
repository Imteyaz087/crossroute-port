
// --- Typst Document Source ---

#let brand-primary = rgb("18181b")
#let brand-accent = rgb("27272a")
#let brand-subtle = rgb("71717a")
#let brand-border = rgb("e4e4e7")
#let bg-zebra = rgb("fafafa")
#let bg-callout-note = rgb("fafafa")
#let bg-callout-tip = rgb("fafafa")
#let bg-callout-warn = rgb("fafafa")
#let bg-callout-alert = rgb("fafafa")
#set text(font: ("PingFang TC", "Helvetica", "Arial"), size: 9.5pt, fill: rgb("27272a"))
#set par(justify: false, leading: 0.65em)

#set text(lang: "zh", region: "TW")

#let doc-title = "CrossRoute 企業先導驗證訂購單暨服務合約 (Paid Pilot Order Form)"
#let doc-subtitle = ""
#let doc-author = ""
#let doc-date = "2026-10-21"
#let doc-footer = ""
#let doc-to = ""

#set document(title: doc-title, author: if doc-author == "" { () } else { doc-author })

#set page(
  paper: "a4",
  margin: (x: 2cm, top: 2.5cm, bottom: 2.5cm),
  columns: 1,
  header: context {
    if counter(page).get().first() > 1 [
      #grid(
        columns: (1fr, 1fr),
        align(left)[#text(8pt, fill: brand-subtle)[#doc-title]],
        align(right)[#text(8pt, fill: brand-subtle)[#doc-date]]
      )
      #v(-3pt)
      #line(length: 100%, stroke: 0.4pt + brand-border)
    ]
  },
  footer: context {
    grid(
      columns: (1fr, 1fr),
      align(left)[#text(7.5pt, fill: brand-subtle)[#doc-footer]],
      align(right)[#text(8pt, fill: brand-subtle)[Page #counter(page).display("1 of 1", both: true)]]
    )
  }
)

// Headings: sticky blocks prevent orphan headings at the bottom of pages
#show heading: set block(sticky: true)
#show heading.where(level: 1): set text(16pt, weight: "bold", fill: brand-primary)
#show heading.where(level: 1): set block(above: 12pt, below: 9pt, inset: (bottom: 4pt), width: 100%, stroke: (bottom: 1.2pt + brand-primary))
#show heading.where(level: 2): set text(13pt, weight: "bold", fill: brand-primary)
#show heading.where(level: 2): set block(above: 10pt, below: 4pt)
#show heading.where(level: 3): set text(11pt, weight: "bold", fill: brand-primary)
#show heading.where(level: 3): set block(above: 8pt, below: 2pt)

// Breakable raw code blocks
#show raw.where(block: true): it => block(
  width: 100%, breakable: true, fill: rgb("f8fafc"),
  stroke: 0.5pt + brand-border, radius: 4pt, inset: 9pt,
  text(8.5pt, font: ("Menlo", "Monaco", "Courier"), it)
)
#show raw.where(block: false): it => box(
  fill: rgb("f1f5f9"), radius: 2.5pt, inset: (x: 3.5pt, y: 1.5pt), outset: (y: 1.5pt),
  text(8.5pt, font: ("Menlo", "Monaco", "Courier"), it)
)

// Admonitions / Callouts
#let admonition(type, body) = {
  let color = brand-accent
  let bg = bg-callout-note
  let icon = "ℹ"
  let title = "NOTE"

  if type == "TIP" {
    color = rgb("16a34a")
    bg = bg-callout-tip
    icon = "💡"
    title = "TIP"
  } else if type == "WARNING" {
    color = rgb("d97706")
    bg = bg-callout-warn
    icon = "⚠"
    title = "WARNING"
  } else if type == "IMPORTANT" {
    color = rgb("7c3aed")
    bg = bg-callout-note
    icon = "★"
    title = "IMPORTANT"
  } else if type == "CAUTION" {
    color = rgb("dc2626")
    bg = bg-callout-alert
    icon = "⚡"
    title = "CAUTION"
  }

  v(6pt)
  block(
    width: 100%, breakable: true, fill: bg,
    stroke: (left: 3pt + color, rest: 0.4pt + brand-border),
    radius: (right: 4pt), inset: (x: 12pt, y: 9pt),
    [
      #grid(columns: (auto, 1fr), gutter: 8pt, text(10pt, fill: color)[*#icon #title*], [])
      #v(2pt)
      #text(9pt)[#body]
    ]
  )
  v(6pt)
}

#let quote-box(body) = block(
  width: 100%, breakable: true, stroke: (left: 3.5pt + brand-primary),
  inset: (x: 12pt, y: 9pt), radius: (right: 4pt), body
)




= #"CrossRoute 企業先導驗證訂購單暨服務合約 (Paid Pilot Order Form)" <h-1>
== #"90-Day Commercial Pilot Agreement & Telematics Service Order" <h-2>

#line(length: 100%, stroke: 0.5pt + brand-border)

#quote-box[#strong[#"本契約由以下雙方於中華民國 115 年 11 月簽署共同遵守："] \
#strong[#"服務提供方 (Service Provider)"]#"："#strong[#"CrossRoute 智慧綠能聯隊 (CrossRoute Telematics)"] \
#strong[#"客戶採購方 (Customer / Fleet Operator)"]#"："#strong[#strong[#strong[#strong[#strong[#"____"]]]]#" (以下簡稱「甲方」)"] \]

#line(length: 100%, stroke: 0.5pt + brand-border)

=== #"一、 先導驗證專案基本條款 (Pilot Order Summary)" <h-3>

#table(columns: (31fr, 60fr,), align: (left, left,),
  stroke: (x, y) => if y == 0 { (bottom: 1.5pt + brand-primary) } else { (bottom: 0.4pt + brand-border) },
  fill: (col, row) => if calc.even(row) { bg-zebra } else { none },
  inset: (x: 8pt, y: 7pt),
  table.header(repeat: true, [#strong[#"項目 (Item)"]], [#strong[#"規格與商務條件 (Specifications & Terms)"]]),
  [#strong[#"先導測試場域 (Test Corridor)"]], [#"高雄港第 4、5 貨櫃中心（63–66 號及 77–81 號碼頭）至 仁武／前鎮／小港冷鏈物流中心"], [#strong[#"測試車隊規模 (Pilot Fleet Size)"]], [#strong[#"首波驗證車輛 5 輛"]#"（支援 35T/43T 柴油拖車頭 或 中華汽車 CMC ET35 商用電動車）"], [#strong[#"專案執行期程 (Term)"]], [#strong[#"自合約生效日起共計 90 個日曆天"]#"（含前 14 天「無干預對照基準期」）"], [#strong[#"先導服務費用 (Pilot Fee)"]], [#strong[#"每車每月 NT$ 1,800 元整"]#"（5 輛車 × 3 個月，專案總金額為 "#strong[#"NT$ 27,000 元整"]#"，未稅）"], [#strong[#"硬體保證金與租借"]], [#"硬體由 CrossRoute 全額提供借測（免收押金，驗證期滿若未續約由乙方無償收回）"], [#strong[#"專案費用 100% 抵扣條款"]], [#strong[#"甲方於先導期滿轉換為正式年度 SaaS 合約時，本先導期支付之 NT$ 27,000 元得全額抵扣首年訂閱費用！"]])

#line(length: 100%, stroke: 0.5pt + brand-border)

=== #"二、 工作範疇 (Annex A: Scope of Work)" <h-4>

1. #strong[#"非侵入式硬體安裝"]#"："
   - #"乙方指派專責工程師於 30 分鐘內完成車載 J1939 CAN-bus 唯讀讀取器與冷藏櫃磁吸式溫度探針安裝，"#strong[#"保證不剪線、不破線、絕不影響車輛原廠保固"]#"。"
2. #strong[#"對照組基準建立 (14-Day Baseline)"]#"："
   - #"前 14 天維持現行「發電機全趟運轉」模式，精準記錄每輛車每趟之柴油消耗量、回風溫度及港區怠速時數，建立科學量測對照基準。"
3. #strong[#"綠色通行證 (Zero-Genset Green Pass) 智能調度"]#"："
   - #"依據貨物熱慣性（36 MJ/°C）與高雄即時氣象及過港隧道交通路況，動態簽發「免掛柴油發電機通行許可」，每趟替甲方節省 NT$ 1,610 元。"
4. #strong[#"即時雙重失效防護 (Fail-Safe Abort Protocol)"]#"："
   - #"當車內回風溫升達到 "$+1.0^ compose"C"$#" 時，車載系統自動切換至 "#raw("THERMAL_WATCH")#" 狀態並蜂鳴警示；若達 "$+1.8^ compose"C"$#" 或遇重大塞車，系統立即導航至預約之小港四號門 380V 緊急岸電插座充冷，"#strong[#"確保 100% 零貨損風險"]#"。"
5. #strong[#"ISO 14083 / GLEC Tier-3 查證報告產出"]#"："
   - #"每趟次自動生成 Ed25519 數位簽章存證之碳足跡報告，供甲方直接提報 ESG 減碳實績與 CBAM 申報。"

#line(length: 100%, stroke: 0.5pt + brand-border)

=== #"三、 服務水準與責任免責防護 (Annex B: SLA & Liability Firewall)" <h-5>

#quote-box[#"⚠️ "#strong[#"【關鍵貨損責任免責聲明 (Cargo Liability Clause)】"] \
1. #strong[#"服務本質定位"]#"：CrossRoute 系統為"#strong[#"「決策輔助與能效最佳化遙測平台」"]#"，乙方非貨物之運送人 (Carrier) 或受託保管人 (Custodian)。既有貨物運送契約之法律責任與保險責任歸屬不因使用本系統而轉移。" \
2. #strong[#"駕駛與調度員最終控制權 (Operator Override)"]#"：甲方駕駛員在任何突發情況下，均保有隨時手動重新啟動柴油發電機之完全權利，乙方不因駕駛決定恢復供電而課予任何違約懲罰。" \
3. #strong[#"賠償責任上限 (Liability Cap)"]#"：除法律強制規定不得限制者外，乙方因本合約所生之一切損害賠償總額，"#strong[#"以甲方最近三個月內實際支付予乙方之先導服務費用總額為絕對上限（即不超過 NT$ 27,000 元）"]#"。乙方絕不對間接損害、商業利潤損失或貨物本身價值負賠償責任。"]

#line(length: 100%, stroke: 0.5pt + brand-border)

=== #"四、 先導驗證驗收與晉級正式合作標準 (Exit & Conversion Criteria)" <h-6>

#"本先導案於 90 天屆滿時，符合下列任二項指標即視為驗收合格，雙方得直接簽署正式營運維護合約："
1. #strong[#"經濟成效"]#"：測試車隊每趟次平均節省發電機燃料與租賃成本 $\\ge \\text{NT\\$ } 1,200\\text{ 元}$。"
2. #strong[#"冷鏈安全"]#"：全程 100% 無任何因拔除發電機導致之貨物核心溫度超標或退運事件。"
3. #strong[#"系統可用度"]#"：車載端遙測數據上傳成功率 "$ >= 98.5\%$#"。"

#line(length: 100%, stroke: 0.5pt + brand-border)

=== #"五、 雙方簽署 (Signatures)" <h-7>

#strong[#"甲方 (Customer / 車隊營運方)"]#"：" \
#"公司名稱："#strong[#strong[#strong[#strong[#strong[#strong[#strong[#"__"]]]]]]] \
#"統一編號："#strong[#strong[#strong[#strong[#strong[#strong[#strong[#"__"]]]]]]] \
#"代表人 / 授權主管簽署："#strong[#strong[#strong[#strong[#"__"]]]] \
#"職稱："#strong[#strong[#strong[#strong[#strong[#strong[#strong[#strong[#"__"]]]]]]]] \
#"簽署日期：中華民國 115 年 "#strong[#"__ 月 __"]#" 日" \

#strong[#"乙方 (Service Provider / 系統提供方)"]#"：" \
#"團隊名稱："#strong[#"CrossRoute 智慧綠能聯隊 (CrossRoute Telematics)"] \
#"團隊代表簽署："#strong[#"伊穆泰 (Imteyaz Ahmad)"] \
#"身分證明編號：中華民國 APRC E800004605" \
#"聯絡電話：0936663180 / 0911691170" \
#"官方信箱："#raw("imteyaz087@gmail.com") \
#"簽署日期：中華民國 115 年 "#strong[#"__ 月 __"]#" 日" \

