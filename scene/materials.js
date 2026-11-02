import * as THREE from 'three';
import { PALETTE } from './truck-design.js';

const std = (color, roughness, metalness, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

// Warm ceramic bodywork, muted graphite mechanics and restrained status accents.
// No transparent/transmissive glass pass: the cab glazing is reflective opaque glass.
export const M = {
  cabPaint:      new THREE.MeshPhysicalMaterial({ color: PALETTE.cabPaint, roughness: .34, metalness: .08, clearcoat: .55, clearcoatRoughness: .18 }),
  cabAccent:     std(PALETTE.cabAccent, .5, .15),
  glass:         std(PALETTE.glass, .16, .45),
  chassis:       std(PALETTE.chassis, .68, .45),
  tyre:          std(PALETTE.tyre, .94, 0),
  rim:           std(PALETTE.rim, .32, .85),
  battery:       std(PALETTE.battery, .52, .35),
  reeferSkin:    std(PALETTE.reeferSkin, .48, .12),
  reeferRib:     std(PALETTE.reeferRib, .5, .3),
  interior:      std(PALETTE.interior, .65, .2),
  carrier:       std(PALETTE.carrier, .55, .3),
  carrierGrille: std(PALETTE.carrierGrille, .76, .15),
  pallet:        std(0xa88f6e, 0.85, 0),
  cargo:         std(0xc9b79c, 0.75, 0),
  node:          std(0x2b2826, 0.35, 0.6),
  ledOk:         std(0x10b981, 0.4, 0, { emissive: 0x10b981, emissiveIntensity: 2 }),
  cable:         std(0x262422, 0.6, 0.1),
  lamp:          std(PALETTE.lamp, .3, .05, {emissive: PALETTE.lamp, emissiveIntensity:.35}),
  tailLamp:      std(PALETTE.tailLamp, .38, .05, {emissive: PALETTE.tailLamp, emissiveIntensity:.18}),
  reflector:     std(PALETTE.reflector, .38, .3),
};
