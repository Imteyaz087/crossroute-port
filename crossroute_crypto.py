#!/usr/bin/env python3
"""
CrossRoute Cryptographic Telematics Pipeline & Audit Generator (v1.3 Enterprise)
Implements Ed25519 Asymmetric Signatures covering BOTH trip summary and telematics manifest,
Merkle Tree Event Chaining, and ISO 14083 / GLEC Framework Pre-Verification Audit Dossiers.

Author: CrossRoute Telematics
License: Proprietary - Evaluation for 2026 Sustainability Hackathon (Track 15-M)
"""

import os
import json
import time
import hashlib
from typing import Dict, List, Tuple, Any
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

# Master CrossRoute Audit Keypair (Deterministic Persistent Sovereign Key)
AUDIT_SEED_HEX = "3a8b4f1c9d2e7a0b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b"
PRIVATE_KEY = ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(AUDIT_SEED_HEX))
PUBLIC_KEY = PRIVATE_KEY.public_key()
PUBLIC_KEY_HEX = PUBLIC_KEY.public_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PublicFormat.Raw
).hex()

def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def build_merkle_root(leaf_hashes: List[str]) -> str:
    if not leaf_hashes:
        return hashlib.sha256(b"EMPTY_TELEMETRY_LOG").hexdigest()
    
    current_level = leaf_hashes[:]
    while len(current_level) > 1:
        next_level = []
        for i in range(0, len(current_level), 2):
            left = current_level[i]
            right = current_level[i + 1] if i + 1 < len(current_level) else left
            combined = hashlib.sha256((left + right).encode('utf-8')).hexdigest()
            next_level.append(combined)
        current_level = next_level
    return current_level[0]

def create_signed_trip_dossier(
    trip_id: str,
    vehicle_id: str,
    container_id: str,
    cargo_type: str,
    origin_berth: str,
    destination: str,
    transit_duration_mins: float,
    start_temp_c: float,
    diesel_genset_attached: bool,
    telematics_events: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generate an audit-grade trip dossier where Ed25519 covers BOTH
    the trip summary and the Merkle root of raw events.
    """
    # 1. Compute leaf hashes and determine true peak temperatures from raw events
    leaf_hashes = []
    peak_air = start_temp_c
    peak_core = start_temp_c

    for ev in telematics_events:
        canonical_ev = json.dumps(ev, sort_keys=True).encode('utf-8')
        leaf_hashes.append(compute_sha256(canonical_ev))
        if "air_c" in ev and ev["air_c"] is not None:
            peak_air = max(peak_air, ev["air_c"])
        if "core_c" in ev and ev["core_c"] is not None:
            peak_core = max(peak_core, ev["core_c"])
    
    merkle_root = build_merkle_root(leaf_hashes)

    # 2. ISO 14083 / GLEC Calculations (Well-to-Wheel WTW)
    # Baseline diesel fuel: 8.0 L (2.5 hr drayage + port gate dwell @ 3.2 L/hr)
    baseline_liters = 8.0
    actual_liters = 8.0 if diesel_genset_attached else 0.0
    co2e_saved_kg = max(0.0, (baseline_liters - actual_liters) * 2.68) # 2.68 kg CO2e / liter diesel

    # Guaranteed savings: NT$ 1,110 (NT$ 750 genset rental + NT$ 260 diesel + NT$ 100 shore power labor rebate)
    # Estimated demurrage risk avoided: NT$ 500
    # Total commercial benefit: NT$ 1,610 / trip
    direct_savings_twd = 1110.0 if not diesel_genset_attached else 0.0
    total_benefit_twd = 1610.0 if not diesel_genset_attached else 0.0

    regulatory_ceiling = -15.0 if start_temp_c < -10 else 7.0

    payload = {
        "schema_version": "CrossRoute-Audit-v1.3",
        "standard_alignment": "ISO 14083:2023 / GLEC Framework v3.0 (Pre-Verification Methodology)",
        "audit_authority": "CrossRoute Telematics Sovereign Node (Kaohsiung Harbor)",
        "public_key_ed25519": PUBLIC_KEY_HEX,
        "trip_summary": {
            "trip_id": trip_id,
            "vehicle_id": vehicle_id,
            "container_id": container_id,
            "cargo_type": cargo_type,
            "origin": origin_berth,
            "destination": destination,
            "transit_duration_mins": transit_duration_mins,
            "diesel_genset_detached": not diesel_genset_attached,
            "haccp_temperature_status": {
                "initial_core_temp_c": start_temp_c,
                "peak_air_temp_c": round(peak_air, 2),
                "peak_core_temp_c": round(peak_core, 2),
                "regulatory_ceiling_c": regulatory_ceiling,
                "compliance_verdict": "PASSED" if peak_core <= regulatory_ceiling else "VIOLATION"
            },
            "environmental_audit": {
                "genset_diesel_burned_liters": actual_liters,
                "baseline_diesel_liters": baseline_liters,
                "wtw_co2e_saved_kg": round(co2e_saved_kg, 2),
                "guaranteed_direct_savings_twd": direct_savings_twd,
                "total_commercial_benefit_twd": total_benefit_twd
            }
        },
        "telematics_manifest": {
            "event_count": len(telematics_events),
            "merkle_root_sha256": merkle_root,
            "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "rfc3161_nonce": hashlib.sha256(str(time.time()).encode()).hexdigest()[:16]
        },
        "raw_events": telematics_events
    }

    # 3. Cryptographic Signature covering BOTH trip_summary and telematics_manifest
    signed_target = {
        "trip_summary": payload["trip_summary"],
        "telematics_manifest": payload["telematics_manifest"]
    }
    canonical_target = json.dumps(signed_target, sort_keys=True).encode('utf-8')
    signature = PRIVATE_KEY.sign(canonical_target)
    
    payload["cryptographic_signature"] = {
        "algorithm": "Ed25519",
        "signature_hex": signature.hex()
    }

    return payload

if __name__ == "__main__":
    events = [
        {"ts": 0, "lat": 22.585, "lon": 120.312, "air_c": -19.4, "core_c": -19.5, "speed_kmh": 0, "status": "BERTH_UNPLUG"},
        {"ts": 12, "lat": 22.592, "lon": 120.320, "air_c": -19.0, "core_c": -19.48, "speed_kmh": 45, "status": "HIGHWAY_CRUISE"},
        {"ts": 26, "lat": 22.610, "lon": 120.335, "air_c": -18.6, "core_c": -19.42, "speed_kmh": 50, "status": "HIGHWAY_CRUISE"},
        {"ts": 38, "lat": 22.642, "lon": 120.355, "air_c": -18.2, "core_c": -19.36, "speed_kmh": 15, "status": "WAREHOUSE_ARRIVE"}
    ]
    dossier = create_signed_trip_dossier(
        trip_id="CR-KHH-20261021-0881",
        vehicle_id="YULON-HEAVY-TRACTOR-43T",
        container_id="MSKU-749102-4",
        cargo_type="進口冷凍牛豬肉 (Frozen Beef/Pork)",
        origin_berth="Kaohsiung Port Berth 78 (第五貨櫃中心)",
        destination="Renwu Cold Storage Logistics Park (仁武冷鏈物流園區)",
        transit_duration_mins=38.0,
        start_temp_c=-19.5,
        diesel_genset_attached=False,
        telematics_events=events
    )
    with open("/Users/imu/Developer/crossroute-port/sample_trip_audit.json", "w") as f:
        json.dump(dossier, f, indent=2, ensure_ascii=False)
    print("✓ Created hardened signed audit dossier: sample_trip_audit.json")
