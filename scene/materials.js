import * as THREE from 'three';

const std = (color, roughness, metalness, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

// Zero-Blue Industrial Studio: R >= G >= B across all neutrals & metals
export const M = {
  cabPaint:      new THREE.MeshPhysicalMaterial({ color: 0xe9e6e1, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 }),
  cabAccent:     std(0x2b2826, 0.45, 0.3),
  glass:         new THREE.MeshPhysicalMaterial({ color: 0x1f1d1b, roughness: 0.05, metalness: 0, transmission: 0, clearcoat: 1 }),
  chassis:       std(0x262422, 0.6, 0.7),
  tyre:          std(0x161514, 0.92, 0),
  rim:           std(0xb8b4ae, 0.28, 1),
  battery:       std(0x3a3632, 0.5, 0.55),
  reeferSkin:    new THREE.MeshPhysicalMaterial({ color: 0xf1eee9, roughness: 0.3, metalness: 0.1, clearcoat: 0.6 }),
  reeferRib:     std(0xd6d2cc, 0.4, 0.3),
  interior:      std(0xcfcbc5, 0.35, 0.8),
  carrier:       std(0x383430, 0.55, 0.4),
  carrierGrille: std(0x22201e, 0.7, 0.5),
  pallet:        std(0xa88f6e, 0.85, 0),
  cargo:         std(0xc9b79c, 0.75, 0),
  node:          std(0x2b2826, 0.35, 0.6),
  ledOk:         std(0x10b981, 0.4, 0, { emissive: 0x10b981, emissiveIntensity: 2 }),
  cable:         std(0x262422, 0.6, 0.1),
};
