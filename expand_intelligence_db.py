#!/usr/bin/env python3
"""
Expands crossroute_pitch_intelligence.db with:
1. breakthrough_presentation_techniques (from global TV & YouTube pitch analysis)
2. master_strategic_plan (phase-by-phase execution to Dec 13 Finals & B2B deployment)
3. oem_powertrain_matrix (CMC ET35 LCV vs 43T Heavy Prime Mover specs & protocols)
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crossroute_pitch_intelligence.db")

def expand_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. breakthrough_presentation_techniques
    cur.execute("""
    CREATE TABLE IF NOT EXISTS breakthrough_presentation_techniques (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        technique_name TEXT NOT NULL,
        source_show_or_channel TEXT NOT NULL,
        category TEXT NOT NULL,
        core_mechanism TEXT NOT NULL,
        crossroute_application TEXT NOT NULL,
        verifiable_impact_score INTEGER NOT NULL
    );
    """)

    # 2. master_strategic_plan
    cur.execute("""
    CREATE TABLE IF NOT EXISTS master_strategic_plan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phase_name TEXT NOT NULL,
        target_date TEXT NOT NULL,
        milestone_objective TEXT NOT NULL,
        counterparty_entity TEXT NOT NULL,
        execution_deliverable TEXT NOT NULL,
        validation_status TEXT NOT NULL
    );
    """)

    # 3. oem_powertrain_matrix
    cur.execute("""
    CREATE TABLE IF NOT EXISTS oem_powertrain_matrix (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_class TEXT NOT NULL,
        target_model TEXT NOT NULL,
        can_bus_protocol TEXT NOT NULL,
        idle_burn_rate_lph REAL NOT NULL,
        deadweight_penalty_kg REAL NOT NULL,
        thermal_virtual_battery_kwh REAL NOT NULL,
        gross_margin_savings_ntd REAL NOT NULL
    );
    """)

    # Clear prior extensions to allow idempotent runs
    cur.execute("DELETE FROM breakthrough_presentation_techniques;")
    cur.execute("DELETE FROM master_strategic_plan;")
    cur.execute("DELETE FROM oem_powertrain_matrix;")

    # Populate breakthrough_presentation_techniques
    techniques = [
        (
            "The 20-Second Dawn Video Testimonial Anchor",
            "YouTube Blue-Collar Documentaries & Shark Tank S12",
            "Emotional Hook",
            "Brings the authentic reality of the worker into the boardroom without violating competition bylaws. Showing the driver's exhausted face at 05:30 AM with the deafening 85dB roar eliminates abstract skepticism immediately.",
            "22-second 4K video of Brother Bao filmed at Kaohsiung Berth 78 at dawn, explaining the generator noise and his granddaughter's pediatric asthma.",
            98
        ),
        (
            "The Physical Isolation Harness Hand-Off",
            "Dragons' Den UK & Shark Tank Hardware Pitches",
            "Physical Prop",
            "Overcomes the 'it's just a student software mock' objection by physically handing the executive judge an industrial-grade physical object. Tactile contact forces judges to realize this is a manufactured tool, not a Figma slide.",
            "Handing the ISO 11898-2 passive optical isolation Y-cable in a transparent acrylic display case directly to the China Motor VP.",
            95
        ),
        (
            "Auditorium Real-Time Smartphone Interactivity",
            "TechCrunch Disrupt Battlefield & Apple Keynotes",
            "Commercial Proof",
            "Puts the software directly into the judge's hands. If judges can scan a QR code and trigger dynamic Fourier calculations on their personal iPhones in 300ms, all doubt regarding engineering readiness evaporates.",
            "Displaying an interactive QR code on Slide 4 directing judges to imteyaz087.github.io/crossroute-port/ with live scenario switching.",
            96
        ),
        (
            "The Manager Signature Cap Reverse-Close",
            "Y Combinator B2B Sales Framework",
            "Reversing Risk",
            "Enterprise sales cycles take 9 months because deals exceed discretionary spending caps. Pricing a paid pilot at NT$27,000 (beneath the NT$100,000 department cap) allows the VP to sign without CFO committee approval.",
            "Presenting a pre-printed, 2-page binding Pilot Agreement for 20 trucks with payback in 14.2 days and a 100% money-back guarantee.",
            99
        ),
        (
            "The Moral Duty & Commercial Greed Synthesis",
            "The Profit & Shark Tank India (Locus / Revamp Moto)",
            "Dual-Engine Narrative",
            "Unifies deep social justice (ending driver hearing loss and child asthma) with greedy unit economics (saving NT$1,610/trip and unlocking 4,200 truck chassis sales). The judge feels heroic while boosting their division P&L.",
            "Minute 7-9 pitch climax: Proving that doing the right thing for Kaohsiung drivers is the exact catalyst that makes Yulon dominate electric commercial freight in Taiwan.",
            97
        )
    ]
    cur.executemany("""
    INSERT INTO breakthrough_presentation_techniques (
        technique_name, source_show_or_channel, category, core_mechanism, crossroute_application, verifiable_impact_score
    ) VALUES (?, ?, ?, ?, ?, ?)
    """, techniques)

    # Populate master_strategic_plan
    plans = [
        (
            "Phase 1: Competition Package Lock & Proposal Submission",
            "2026-11-18",
            "Official preliminary proposal upload to CMU I-Lab portal (Track 15-M Yulon Group).",
            "CMU I-Lab & Yulon Organizing Committee",
            "CrossRoute_Yulon_Official_Proposal_Deck.pdf (7 pages, TFDA/ISO compliant, 5/5 unit tests)",
            "VERIFIED"
        ),
        (
            "Phase 2: Video Asset Production & Hardware Acrylic Assembly",
            "2026-11-28",
            "Produce the 22-second 4K dawn video clip at Kaohsiung Port Berth 78 and assemble the acrylic harness prop.",
            "Kaohsiung Drayage Partners & Prototype Shop",
            "22s 4K MP4 Video File + Physical ISO 11898-2 Optical Tap in Acrylic Case",
            "IN_PROGRESS"
        ),
        (
            "Phase 3: Rehearsal & Live Mobile Auditorium Stress-Test",
            "2026-12-05",
            "Conduct full 10-minute presentation dry-run with 5-minute Q&A defense matrix across 10 mobile test devices.",
            "Internal AI Council & Faculty Advisor Prof. Wu Chang-Tzuoh",
            "10-minute second-by-second presentation script + 600-second slide synchronization",
            "SCHEDULED"
        ),
        (
            "Phase 4: Championship Stage Execution at China Medical University",
            "2026-12-13",
            "Deliver championship pitch, execute live smartphone test, hand pilot agreement to Yulon VP, win Gold Prize.",
            "Yulon Group Executive Jury (CMC, Car Plus, TAC)",
            "Gold Prize Trophy / NT$100,000+ top award + signed Pilot Letter of Intent",
            "SCHEDULED"
        ),
        (
            "Phase 5: 90-Day Paid Commercial Pilot Deployment",
            "2027-01-15",
            "Deploy CrossRoute onto 20 commercial trucks with China Motor & Car Plus in Kaohsiung Port Corridor.",
            "China Motor Commercial Fleet Division & Car Plus",
            "Live telematics stream, NT$32,200/day customer fuel savings, Ed25519 digital certificates",
            "SCHEDULED"
        )
    ]
    cur.executemany("""
    INSERT INTO master_strategic_plan (
        phase_name, target_date, milestone_objective, counterparty_entity, execution_deliverable, validation_status
    ) VALUES (?, ?, ?, ?, ?, ?)
    """, plans)

    # Populate oem_powertrain_matrix
    powertrain = [
        (
            "Heavy Duty Prime Mover (43T GCW)",
            "Fuso Super Great / HINO 700 / Scania G450",
            "SAE J1939 (PGN 61444, 65266, 65269)",
            2.40,
            1200.0,
            10.5,
            1610.0
        ),
        (
            "Light Commercial Electric Vehicle (3.5T LCV)",
            "China Motor CMC ET35 / J SPACE EV",
            "ISO 15765-4 / UDS (Diagnostic CAN)",
            0.00,
            1200.0,
            10.5,
            1610.0
        ),
        (
            "Clip-on Diesel Generator (Auxiliary Genset)",
            "Thermo King SG-3000 / Carrier UG15",
            "ISO 10368 / RS-485 Reefer MicroLink",
            3.20,
            1200.0,
            0.0,
            -1900.0
        )
    ]
    cur.executemany("""
    INSERT INTO oem_powertrain_matrix (
        vehicle_class, target_model, can_bus_protocol, idle_burn_rate_lph, deadweight_penalty_kg, thermal_virtual_battery_kwh, gross_margin_savings_ntd
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, powertrain)

    conn.commit()
    print(f"✅ Successfully expanded {DB_PATH}")
    cur.execute("SELECT COUNT(*) FROM breakthrough_presentation_techniques;")
    print(f"  - breakthrough_presentation_techniques: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM master_strategic_plan;")
    print(f"  - master_strategic_plan: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM oem_powertrain_matrix;")
    print(f"  - oem_powertrain_matrix: {cur.fetchone()[0]}")
    conn.close()

if __name__ == "__main__":
    expand_db()
