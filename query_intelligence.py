#!/usr/bin/env python3
"""
CLI Query Tool for CrossRoute Pitch & Strategy Intelligence Database
Usage:
  python3 query_intelligence.py summary
  python3 query_intelligence.py cases
  python3 query_intelligence.py emotions
  python3 query_intelligence.py qa
  python3 query_intelligence.py techniques
  python3 query_intelligence.py plan
  python3 query_intelligence.py sql "SELECT ..."
"""

import sqlite3
import sys
import os
import json

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crossroute_pitch_intelligence.db")

def get_conn():
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found.")
        sys.exit(1)
    return sqlite3.connect(DB_PATH)

def print_table(headers, rows):
    col_widths = [len(h) for h in headers]
    for row in rows:
        for idx, val in enumerate(row):
            col_widths[idx] = max(col_widths[idx], len(str(val)[:45]))
    
    header_line = " | ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    sep_line = "-+-".join("-" * col_widths[i] for i in range(len(headers)))
    print(header_line)
    print(sep_line)
    for row in rows:
        print(" | ".join(str(val)[:45].ljust(col_widths[i]) for i, val in enumerate(row)))

def main():
    if len(sys.argv) < 2:
        cmd = "summary"
    else:
        cmd = sys.argv[1].lower()

    conn = get_conn()
    cur = conn.cursor()

    if cmd == "summary":
        print(f"📊 CrossRoute Pitch Intelligence Database ({DB_PATH})")
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        tables = [t[0] for t in cur.fetchall()]
        for t in tables:
            cur.execute(f"SELECT COUNT(*) FROM {t};")
            count = cur.fetchone()[0]
            print(f"  • {t.ljust(40)}: {count} records")

    elif cmd == "cases":
        print("🌍 GLOBAL PITCH CASE STUDIES (Shark Tank, Disrupt, YC, Port Challenges):")
        cur.execute("SELECT startup_name, show_code, vertical, result, crossroute_superiority_factor FROM pitch_case_studies;")
        rows = cur.fetchall()
        print_table(["Startup", "Show", "Vertical", "Result", "CrossRoute Superiority Moat"], rows)

    elif cmd == "emotions":
        print("❤️ HUMAN & EMOTIONAL PAIN DIMENSIONS (Kaohsiung Port Drayage):")
        cur.execute("SELECT human_dimension, stakeholder, measurable_human_impact FROM emotional_human_dimensions;")
        rows = cur.fetchall()
        print_table(["Human Dimension", "Stakeholder", "Measurable Impact"], rows)

    elif cmd == "qa":
        print("🛡️ JUDGE HOSTILE Q&A COUNTER-PUNCH MATRIX:")
        cur.execute("SELECT judge_role, hostile_question, counter_punch_15s FROM judge_hostile_qa_matrix;")
        rows = cur.fetchall()
        print_table(["Judge Role", "Hostile Question", "15-Second Counter Punch"], rows)

    elif cmd == "techniques":
        print("💡 BREAKTHROUGH PRESENTATION TECHNIQUES:")
        cur.execute("SELECT technique_name, source_show_or_channel, category, crossroute_application FROM breakthrough_presentation_techniques;")
        rows = cur.fetchall()
        print_table(["Technique", "Source Channel", "Category", "CrossRoute Application"], rows)

    elif cmd == "plan":
        print("📅 MASTER STRATEGIC EXECUTION PLAN:")
        cur.execute("SELECT phase_name, target_date, counterparty_entity, validation_status FROM master_strategic_plan;")
        rows = cur.fetchall()
        print_table(["Phase", "Target Date", "Counterparty", "Status"], rows)

    elif cmd == "sql":
        if len(sys.argv) < 3:
            print("Usage: query_intelligence.py sql \"<query>\"")
            return
        query = sys.argv[2]
        cur.execute(query)
        rows = cur.fetchall()
        if cur.description:
            headers = [d[0] for d in cur.description]
            print_table(headers, rows)
        else:
            print(f"Executed. Rows affected: {cur.rowcount}")

    conn.close()

if __name__ == "__main__":
    main()
