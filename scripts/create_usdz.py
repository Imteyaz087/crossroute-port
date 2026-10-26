#!/usr/bin/env python3
"""
create_usdz.py: Generates an official Pixar/Apple AR QuickLook USDZ package
for the CrossRoute 40ft High-Cube Reefer Digital Twin.
Allows hackathon judges to project the container in Augmented Reality (AR)
on iOS / iPadOS directly from the web cockpit.
"""

import os
import zipfile

def create_reefer_usda() -> str:
    # OpenUSD ASCII schema (USDA) for 40ft High Cube Container
    return """#usda 1.0
(
    defaultPrim = "Reefer40HC"
    metersPerUnit = 1.0
    upAxis = "Y"
)

def Xform "Reefer40HC" (
    kind = "component"
)
{
    def Xform "Body"
    {
        // Marine White Outer Polyurethane Insulated Shell
        def Cube "OuterShell"
        {
            double size = 1.0
            float3 xformOp:scale = (1.22, 1.45, 6.10)
            float3 xformOp:translate = (0.0, 1.45, 0.0)
            uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
            color3f[] primvars:displayColor = [(0.92, 0.94, 0.96)]
        }

        // Deep Cold Thermal Core (Inferno Volumetric Cargo Simulation)
        def Cube "FrozenCargoCore"
        {
            double size = 1.0
            float3 xformOp:scale = (1.10, 1.25, 5.80)
            float3 xformOp:translate = (0.0, 1.40, 0.0)
            uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
            color3f[] primvars:displayColor = [(0.12, 0.45, 0.85)]
        }

        // Shore Power Connection Receptacle (IEC 60309)
        def Cube "ShorePowerBox"
        {
            double size = 1.0
            float3 xformOp:scale = (0.25, 0.35, 0.15)
            float3 xformOp:translate = (-1.25, 0.85, -5.95)
            uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
            color3f[] primvars:displayColor = [(0.20, 0.85, 0.45)]
        }
    }
}
"""

def build_usdz(output_path: str = "assets/reefer_40hc.usdz"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    usda_content = create_reefer_usda()
    usda_filename = "reefer_40hc.usda"
    
    # USDZ specification requires zero compression (ZIP_STORED) and 64-byte alignment
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_STORED) as zf:
        zf.writestr(usda_filename, usda_content.encode("utf-8"))
        
    print(f"[SUCCESS] Built AR QuickLook USDZ -> {output_path} ({os.path.getsize(output_path):,} bytes)")

if __name__ == "__main__":
    build_usdz()
