// @ts-nocheck
// Перший екран у WebGL: дві сфери SP-P1228 з 3D-моделі (public/m/sphere.bin, зашифрована — вимога ліцензії).
// Позиції/розміри/яскравість сфер задає scenes.js (ORBS: cx, cy, R, lit, depth) — тут лише рендер.
import { loadModel } from "@/lib/model";

const MODEL_R = 0.3045; // радіус каркаса в одиницях моделі

export async function createOrb3D(canvas, { mobile, reduce }) {
  const [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, buf] =
    await Promise.all([
      import("three"),
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      import("three/examples/jsm/environments/RoomEnvironment.js"),
      import("three/examples/jsm/postprocessing/EffectComposer.js"),
      import("three/examples/jsm/postprocessing/RenderPass.js"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
      import("three/examples/jsm/postprocessing/OutputPass.js"),
      loadModel("/m/sphere.bin"),
    ]);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  const env = envRT.texture; // envMap на матеріалі — щоб envMapIntensity змінювалась зі світлом
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((res, rej) => loader.parse(buf, "", res, rej));
  gltf.scene.traverse((n) => { if (n.isMesh) n.geometry.computeVertexNormals(); });
  // імена вузлів: frame, tubes, cores, hanger
  const byName = (nm) => { let m = null; gltf.scene.traverse((n) => { if (!m && n.name === nm) m = n.isMesh ? n : n.children.find((c) => c.isMesh); }); return m; };

  function makeOrb(dim) {
    const outer = new THREE.Group(), inner = new THREE.Group();
    outer.add(inner);
    const chrome = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.86, 0.87, 0.9).multiplyScalar(dim), metalness: 1, roughness: 0.16, envMap: env });
    const glass = new THREE.MeshStandardMaterial({ color: 0xeef2f6, metalness: 0, roughness: 0.1, envMap: env, envMapIntensity: 0.5, transparent: true, opacity: 0.55, emissive: 0xfff1e0, emissiveIntensity: 0, depthWrite: false });
    const core = new THREE.MeshBasicMaterial({ color: 0xfff4e8 });
    const parts = [["frame", chrome, inner], ["tubes", glass, inner], ["cores", core, inner], ["hanger", chrome, outer]];
    for (const [nm, mat, parent] of parts) {
      const s = byName(nm); if (!s) continue;
      const m = new THREE.Mesh(s.geometry, mat);
      // переносимо трансформацію вузла моделі
      s.updateWorldMatrix(true, false); s.matrixWorld.decompose(m.position, m.quaternion, m.scale);
      m.renderOrder = nm === "tubes" ? 2 : 1;
      parent.add(m);
    }
    // шнур підвісу — від верхнього краю підвісу до стелі (поза кадром)
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 40, 6), chrome);
    cord.position.y = 1.31 + 20; outer.add(cord);
    const light = new THREE.PointLight(0xffe3c4, 0, 0, 2); inner.add(light);
    scene.add(outer);
    return { outer, inner, chrome, glass, core, light, dim };
  }
  const orbs = [makeOrb(0.55), makeOrb(1)];

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0, 0.35, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let W = 1, H = 1;
  function resize(w, h, dpr) {
    W = w; H = h;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    // на телефоні bloom у пів-роздільності
    if (mobile) bloom.setSize(Math.round(w * dpr / 2), Math.round(h * dpr / 2));
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // ORBS — масив зі scenes.js (далека, ближня); yaw — спільний кут, tilt — нахил від мишки
  const P = { light: 1.4, env0: 0.1, env1: 0.7 };
  function render(ORBS, yaw, tilt, fade) {
    let maxLit = 0;
    ORBS.forEach((o, i) => {
      const t = orbs[i], z = o.depth < 1 ? -5 : 0, d = camera.position.z - z;
      const ppu = H / (2 * d * tan);
      t.outer.position.set((o.cx - W / 2) / ppu, -(o.cy - H / 2) / ppu, z);
      t.outer.scale.setScalar(o.R / ppu / MODEL_R);
      t.outer.rotation.y = yaw * o.spin + o.off;
      t.inner.rotation.set(tilt.x, 0, tilt.z);
      const L = o.lit * fade, K = t.dim;
      t.core.color.setRGB(1, 0.957, 0.91).multiplyScalar((0.3 + 1.6 * L) * K);
      t.glass.emissiveIntensity = 0.35 * L * K;
      t.glass.opacity = 0.55 * fade;
      t.chrome.envMapIntensity = (P.env0 + P.env1 * L) * fade * (0.4 + 0.6 * K);
      t.light.intensity = L * K * P.light * t.outer.scale.x * t.outer.scale.x * 0.09;
      maxLit = Math.max(maxLit, L);
    });
    bloom.strength = 0.55 * maxLit * (mobile ? 0.6 : 1);
    if (bloom.strength < 0.01) renderer.render(scene, camera); // без bloom дешевше
    else composer.render();
  }

  function dispose() {
    composer.dispose?.(); renderer.dispose(); envRT.dispose();
    scene.traverse((n) => { if (n.isMesh) { n.geometry.dispose(); n.material.dispose(); } });
  }
  void reduce;
  return { resize, render, dispose };
}

export function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
