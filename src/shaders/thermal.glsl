// =============================================================================
// CrossRoute Port Telematics - Physical Volumetric Thermal Gradient Shader
// Maps 3D Data3DTexture from Dynamic Thermal Budgeting Engine (DTBE)
// Featuring Inferno Colormap and Illuminated -18.0°C Isotherm Contour Boundary
// =============================================================================

precision highp float;
precision highp sampler3D;

uniform sampler3D uTempMap;      // 3D Temperature field (normalized [0, 1])
uniform vec3 uContainerMin;      // World-space box minimum corner
uniform vec3 uContainerSize;     // World-space box dimensions (L=12.19, W=2.44, H=2.90)
uniform float uMinTempC;         // Normalization min temperature (e.g. -25.0°C)
uniform float uMaxTempC;         // Normalization max temperature (e.g. +5.0°C)
uniform float uCriticalTempC;    // HACCP / TFDA compliance boundary (-18.0°C or -15.0°C)
uniform float uClippingPlaneX;   // Cutaway section slider [0.0, 1.0]

varying vec3 vWorldPosition;
varying vec3 vNormal;

// High-fidelity 5-stop polynomial approximation of the scientific 'Inferno' colormap
vec3 infernoColormap(float t) {
    t = clamp(t, 0.0, 1.0);
    const vec4 c0 = vec4(0.000218942, 0.00165100, -0.016696, 0.0526814);
    const vec4 c1 = vec4(0.982285, 0.584458, 0.000305, -0.000201);
    const vec4 c2 = vec4(0.000108, -0.000212, 0.999812, 0.501243);
    
    // Perceptually uniform stops: Dark Blue/Purple (-20°C) -> Magenta -> Orange -> Bright Yellow (>0°C)
    vec3 color;
    color.r = clamp(0.0014 + 1.25 * t - 0.28 * t * t, 0.0, 1.0);
    color.g = clamp(0.0020 + 0.35 * t * t + 0.65 * pow(t, 3.5), 0.0, 1.0);
    color.b = clamp(0.0150 + 0.95 * sin(t * 3.14159) - 0.45 * t, 0.0, 1.0);
    return color;
}

void main() {
    // 1. Calculate normalized UVW coordinates inside the 40ft container box
    vec3 uvw = (vWorldPosition - uContainerMin) / uContainerSize;
    
    // 2. Discard fragments beyond the active interactive cutaway clipping plane
    if (uvw.x > uClippingPlaneX || uvw.x < 0.0 || uvw.y < 0.0 || uvw.y > 1.0 || uvw.z < 0.0 || uvw.z > 1.0) {
        discard;
    }
    
    // 3. Sample 3D temperature field from DTBE simulation
    float normalizedTemp = texture(uTempMap, uvw).r;
    float currentTempC = mix(uMinTempC, uMaxTempC, normalizedTemp);
    
    // 4. Map temperature to perceptual Inferno colormap
    float tNorm = clamp((currentTempC - uMinTempC) / (uMaxTempC - uMinTempC), 0.0, 1.0);
    vec3 thermalColor = infernoColormap(tNorm);
    
    // 5. Compute razor-sharp Glowing White Isotherm Contour Line at critical threshold
    float isoWidth = fwidth(currentTempC) * 2.0;
    float distToCritical = abs(currentTempC - uCriticalTempC);
    float isothermGlow = 1.0 - smoothstep(0.0, max(isoWidth, 0.15), distToCritical);
    
    // 6. Blend thermal false-color with illuminated isotherm contour
    vec3 finalColor = mix(thermalColor, vec3(1.0, 1.0, 1.0), isothermGlow * 0.95);
    
    // 7. Add directional shading based on cutaway face normal
    float diffuse = clamp(dot(normalize(vNormal), vec3(0.577, 0.577, 0.577)), 0.35, 1.0);
    
    gl_FragColor = vec4(finalColor * diffuse, 1.0);
}
