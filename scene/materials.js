import * as THREE from 'three';

const std = (color, roughness, metalness, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export const M = {
  cabPaint:   new THREE.MeshPhysicalMaterial({ color: 0xe9eaec, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 }),
  cabAccent:  std(0x1d2230, 0.45, 0.3),
  glass:      new THREE.MeshPhysicalMaterial({ color: 0x0d1118, roughness: 0.05, metalness: 0, transmission: 0, clearcoat: 1 }),
  chassis:    std(0x1a1c22, 0.6, 0.7),
  tyre:       std(0x111215, 0.92, 0),
  rim:        std(0xb9bec8, 0.28, 1),
  battery:    std(0x2a2f3c, 0.5, 0.55),
  reeferSkin: std(0xf2f2ef, 0.38, 0.55),       // corrugated aluminium-white
  reeferRib:  std(0xdcdcd8, 0.45, 0.6),
  interior:   std(0xc7ccd4, 0.3, 0.9),         // stainless liner
  carrier:    std(0x2b2f38, 0.55, 0.4),
  carrierGrille: std(0x15171c, 0.7, 0.6),
  pallet:     std(0x9a7a55, 0.85, 0),
  cargo:      std(0xd9d4c8, 0.75, 0),
  node:       std(0x0f1116, 0.35, 0.6),
  ledOk:      std(0x3ddc97, 0.4, 0, { emissive: 0x3ddc97, emissiveIntensity: 2 }),
  cable:      std(0x15161a, 0.6, 0.1),
};
