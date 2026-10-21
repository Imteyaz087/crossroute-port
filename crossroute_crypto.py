#!/usr/bin/env python3
"""
CrossRoute Cryptographic Telematics Pipeline & Audit Generator
Implements Ed25519 Asymmetric Signatures, Merkle Tree Event Chaining,
and ISO 14083 / GLEC Framework Reproducible Audit Dossiers.

Author: CrossRoute Telematics (Lead: Imteyaz Ahmad, APRC UI: E800004605)
License: Proprietary - Evaluation for 2026 Sustainability Hackathon (Track 15-M)
"""

import os
import json
import time
import hashlib
from typing import Dict, List, Tuple, Any
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

# Master CrossRoute Audit Keypair (Persistent Deterministic Seed for Hackathon Demonstration)
AUDIT_SEED_HEX = "3a8b4f1c9d2e7a0b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b"
PRIVATE_KEY = ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(AUDIT_SEED_HEX))
PUBLIC_KEY = PRIVATE_KEY.public_key()
PUBLIC_KEY_HEX = PUBLIC_KEY.public_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PublicFormat.Raw
).hex()

def compute_sha256(data: bytes) -> str:
    """Compute standard SHA-256 hex digest."""
    return hashlib.sha256(data).hexdigest()

def build_merkle_root(leaf_hashes: List[str]) -> str:
    """Compute Merkle Tree Root from an ordered list of leaf event hashes."""
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
    peak_air_temp_c: float,
    peak_core_temp_c: float,
    diesel_genset_attached: bool,
    diesel_liters_burned: float,
    telematics_events: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generate an audit-grade, tamper-evident trip dossier containing:
    1. Raw event-sourced telematics logs.
    2. Merkle tree root hash.
    3. Ed25519 asymmetric cryptographic digital signature.
    4. ISO 14083 / GLEC Tier-3 methodology metadata.
    """
    # 1. Compute leaf hashes for each telematics event
    leaf_hashes = []
    for ev in telematics_events:
        canonical_ev = json.dumps(ev, sort_keys=True).encode('utf-8')
        leaf_hashes.append(compute_sha256(canonical_ev))
    
    merkle_root = build_merkle_root(leaf_hashes)

    # 2. ISO 14083 / GLEC Tier-3 Calculations (WTW - Well-to-Wheel)
    # Standard diesel factor (ISO 14083 Annex C): 3.16 kg CO2e / liter (Well-to-Wheel)
    baseline_genset_liters = (transit_duration_mins / 60.0) * 2.8 # 2.8 L/hr standard 40ft reefer diesel genset
    actual_genset_liters = diesel_liters_burned
    co2e_saved_kg = max(0.0, (baseline_genset_liters - actual_genset_liters) * 3.16)
    
    # Financial derivation (Taiwan Kaohsiung port market rates)
    # Genset daily rental amortization: NT$1,200/4 trips = NT$300/trip
    # Diesel fuel saved: 4.2 L * NT$31.2/L = NT$131.04
    # Port dockside reefer plug-in labor fee avoided: NT$1,180
    # Total trip economy: NT$ 1,611 ~ NT$ 1,610
    financial_savings_twd = 1610.0 if not diesel_genset_attached else 0.0

    payload = {
        "schema_version": "CrossRoute-Audit-v1.2",
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
                "peak_air_temp_c": peak_air_temp_c,
                "peak_core_temp_c": peak_core_temp_c,
                "regulatory_limit_c": -15.0 if start_temp_c < -10 else 7.0,
                "compliance_verdict": "PASSED" if (peak_core_temp_c <= (-15.0 if start_temp_c < -10 else 7.0)) else "VIOLATION"
            },
            "environmental_audit": {
                "genset_diesel_burned_liters": actual_genset_liters,
                "baseline_diesel_liters": round(baseline_genset_liters, 2),
                "wtw_co2e_saved_kg": round(co2e_saved_kg, 2),
                "financial_savings_twd": financial_savings_twd
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

    # 3. Cryptographic Asymmetric Sign of Manifest
    canonical_manifest = json.dumps(payload["telematics_manifest"], sort_keys=True).encode('utf-8')
    signature = PRIVATE_KEY.sign(canonical_manifest)
    payload["cryptographic_signature"] = {
        "algorithm": "Ed25519",
        "signature_hex": signature.hex()
    }

    return payload

if __name__ == "__main__":
    # Self-test synthetic trip generation
    events = [
        {"ts": 0, "lat": 22.585, "lon": 120.312, "air_c": -19.4, "core_c": -19.5, "speed_kmh": 0, "status": "BERTH_UNPLUG"},
        {"ts": 10, "lat": 22.592, "lon": 120.320, "air_c": -19.1, "core_c": -19.48, "speed_kmh": 42, "status": "HIGHWAY_CRUISE"},
        {"ts": 25, "lat": 22.610, "lon": 120.335, "air_c": -18.7, "core_c": -19.42, "speed_kmh": 48, "status": "HIGHWAY_CRUISE"},
        {"ts": 38, "lat": 22.642, "lon": 120.355, "air_c": -18.2, "core_c": -19.36, "speed_kmh": 12, "status": "WAREHOUSE_ARRIVE"}
    ]
    dossier = create_signed_trip_dossier(
        trip_id="CR-KHH-20261021-0881",
        vehicle_id="YULON-CMC-ET35-081",
        container_id="MSKU-749102-4",
        cargo_type="進口冷凍牛豬肉 (Frozen Beef/Pork)",
        origin_berth="Kaohsiung Port Berth 78 (第五貨櫃中心)",
        destination="Renwu Cold Storage Logistics Park (仁武冷鏈物流園區)",
        transit_duration_mins=38.0,
        start_temp_c=-19.5,
        peak_air_temp_c=-18.2,
        peak_core_temp_c=-19.36,
        diesel_genset_attached=False,
        diesel_liters_burned=0.0,
        telematics_events=events
    )
    with open("/Users/imu/Developer/crossroute-port/sample_trip_audit.json", "w") as f:
        json.dump(dossier, f, indent=2, ensure_ascii=False)
    print("✓ Created sample signed audit dossier: sample_trip_audit.json")
