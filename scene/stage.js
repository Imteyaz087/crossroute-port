import * as THREE from 'three';
import { sceneQuality, configureShaderErrorBoundary } from './observatory-model.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  configureShaderErrorBoundary(renderer);
  renderer.setPixelRatio(sceneQuality(canvas.clientWidth || window.innerWidth, window.devicePixelRatio || 1).pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = canvas.clientWidth >= 700;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = null;                          // CSS radial warm graphite/carbon gradient shows through
  scene.fog = new THREE.Fog(0x0e0d0c, 100, 250);

  // Neutral PBR reflections: no HDR file needed
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  scene.environmentIntensity = 0.65;

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 350);
  camera.position.set(15, 7.0, 24);

  // Key / fill / rim studio lights (Zero-Blue Industrial Studio: R >= G >= B)
  const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
  key.position.set(8, 13, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 50 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  const fill = new THREE.HemisphereLight(0xf2efe9, 0x1f1d1b, 0.6);
  const rim  = new THREE.DirectionalLight(0xf5f1ea, 1.5);
  rim.position.set(-10, 8, -9);
  scene.add(key, fill, rim);

  // Ground: shadow catcher + soft radial contact blob
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(70, 64),
    new THREE.ShadowMaterial({ opacity: 0.42 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground, makeContactBlob());

  const resize = () => {
    const r=canvas.getBoundingClientRect(),w=Math.max(2,r.width),h=Math.max(2,r.height);
    const quality=sceneQuality(w,window.devicePixelRatio||1);renderer.setPixelRatio(quality.pixelRatio);renderer.shadowMap.enabled=quality.shadows;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  resize();

  return { renderer, scene, camera, key, fill, rim, dispose(){observer.disconnect();scene.environment?.dispose();pmrem.dispose();renderer.dispose();} };
}

function makeContactBlob() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.65)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 7),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.005;
  m.renderOrder = -1;
  return m;
}
