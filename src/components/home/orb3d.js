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

  // ---- Світлодіоди: кожен свій (яскравість, мерехтіння), колір — від холодного в центрі до теплого на краях ----
  // 92 світлодіоди злиті в один меш → ділимо вершини на світлодіоди за відстанню (насіння в радіусі 0.12)
  function ledIds(geo) {
    const p = geo.attributes.position, seeds = [], id = new Float32Array(p.count);
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k); let best = -1, bd = 0.0144;
      for (let c = 0; c < seeds.length; c += 3) { const dx = seeds[c] - x, dy = seeds[c + 1] - y, dz = seeds[c + 2] - z, dd = dx * dx + dy * dy + dz * dz; if (dd < bd) { bd = dd; best = c / 3; } }
      if (best < 0) { best = seeds.length / 3; seeds.push(x, y, z); }
      id[k] = best;
    }
    return { id, n: seeds.length / 3 };
  }
  // яскравість кожного світлодіода: більшість приглушені, частина яскраві, кілька «гарячих»
  function ledAttrs(geo, seed) {
    const { id, n } = ledIds(geo);
    let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const B = [], PH = [];
    for (let i = 0; i < n; i++) { const r = rnd(); B.push(r > 0.9 ? 1.25 + rnd() * 0.3 : 0.3 + Math.pow(rnd(), 1.5) * 0.95); PH.push(rnd() * 6.283); }
    const b = new Float32Array(id.length), ph = new Float32Array(id.length);
    for (let k = 0; k < id.length; k++) { b[k] = B[id[k]]; ph[k] = PH[id[k]]; }
    const g = geo.clone();
    g.setAttribute("aB", new THREE.BufferAttribute(b, 1)); g.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
    return g;
  }
  const COOL = new THREE.Color("#FFEBD2"), WARM = new THREE.Color("#FFA24A"); // ≈3600K у центрі → ≈2500K на краях
  function ledMat(additive) {
    return new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Vector3() }, uR: { value: 1 }, uLit: { value: 0 }, uBase: { value: 0.3 }, uGain: { value: P.gain }, uDim: { value: 1 },
        uT: { value: 0 }, uCool: { value: COOL.clone() }, uWarm: { value: WARM.clone() }, uFade: { value: 1 }, uCtr: { value: P.ctr }, uRim: { value: P.rim } },
      vertexShader: `attribute float aB; attribute float aPh; uniform vec3 uC; uniform float uR, uT;
        varying float vR, vB, vZ;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
          vR = length(mv.xy - uC.xy) / uR;               // 0 — центр кулі на екрані, 1 — край
          vZ = clamp((mv.z - uC.z) / uR * .5 + .5, 0., 1.); // 1 — передній бік
          vB = aB * (0.86 + 0.14 * sin(uT * (0.7 + fract(aPh) * 1.6) + aPh));
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uLit, uBase, uGain, uDim, uFade, uCtr, uRim; uniform vec3 uCool, uWarm; varying float vR, vB, vZ;
        void main(){
          float w = smoothstep(.2, 1., vR);
          vec3 c = mix(uCool, uWarm, w * w * (3. - 2. * w) * .85 + w * .15);
          c = mix(vec3(.8), c, clamp(uLit * 1.5, 0., 1.)); // вимкнене — нейтральне
          float k = uBase + uGain * uLit * vB * mix(.75, 1.1, vZ) * mix(uCtr, uRim, w); // на краях кулі діоди видно збоку — щільніше й яскравіше (як на фото)
          gl_FragColor = vec4(c * k * uDim, uFade);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive,
    });
  }
  // м'яке сяйво навколо кулі: біле в центрі → бурштинове → прозоре
  const haloTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,236,214,0.5)"); gr.addColorStop(0.3, "rgba(255,226,196,0.22)");
    gr.addColorStop(0.6, "rgba(255,214,180,0.06)"); gr.addColorStop(1, "rgba(255,210,170,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  // налаштування світла (вибрано за фото живої кулі: читається каркас, діоди — дрібні теплі точки)
  const P = { light: 0.3, env0: 0.1, env1: 0.3, gain: 1.6, glass: 0.15, halo: 0.1, bloom: 0.45, ctr: 0.4, rim: 3 };
  let orbSeed = 11;
  function makeOrb(dim) {
    const outer = new THREE.Group(), inner = new THREE.Group();
    outer.add(inner);
    const chrome = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.86, 0.87, 0.9).multiplyScalar(0.6 * dim) /* темніший хром — щоб читались діоди */, metalness: 1, roughness: 0.16, envMap: env });
    // каркас у світлі: білий у центрі кулі → теплий на краях (як і світлодіоди)
    const cu = { uC: { value: new THREE.Vector3() }, uR: { value: 1 }, uLit: { value: 0 }, uTint: { value: new THREE.Color("#FFC28A") } };
    chrome.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, cu);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform vec3 uC; uniform float uR; varying float vRr;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvRr = length(mvPosition.xy - uC.xy) / uR;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uLit; uniform vec3 uTint; varying float vRr;")
        .replace("#include <opaque_fragment>", "outgoingLight *= mix(vec3(1.), uTint, smoothstep(.25, 1.05, vRr) * uLit);\n#include <opaque_fragment>");
    };
    chrome.customProgramCacheKey = () => "spchrome";
    const glass = ledMat(true); glass.uniforms.uBase.value = 0.05; glass.uniforms.uGain.value = P.glass;
    const core = ledMat(false);
    const seed = (orbSeed += 7919);
    const parts = [["frame", chrome, inner], ["tubes", glass, inner], ["cores", core, inner], ["hanger", chrome, outer]];
    for (const [nm, mat, parent] of parts) {
      const s = byName(nm); if (!s) continue;
      const m = new THREE.Mesh(nm === "tubes" || nm === "cores" ? ledAttrs(s.geometry, seed) : s.geometry, mat);
      // переносимо трансформацію вузла моделі
      s.updateWorldMatrix(true, false); s.matrixWorld.decompose(m.position, m.quaternion, m.scale);
      m.renderOrder = nm === "tubes" ? 2 : 1;
      parent.add(m);
    }
    // шнур підвісу — від верхнього краю підвісу до стелі (поза кадром)
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 40, 6), chrome);
    cord.position.y = 1.31 + 20; outer.add(cord);
    // світло всередині: біле в центрі + тепліше ширше (тепліші відблиски на каркасі по краях)
    const light = new THREE.PointLight(0xfff0e0, 0, 0, 2); inner.add(light);
    const warm = new THREE.PointLight(0xff9a50, 0, 0, 1.4); inner.add(warm);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
    halo.scale.setScalar(MODEL_R * 3.6); halo.renderOrder = -1; outer.add(halo);
    scene.add(outer);
    return { outer, inner, chrome, cu, glass, core, light, warm, halo, dim };
  }
  const orbs = [makeOrb(0.55), makeOrb(1)];

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0, 0.22, 0.9);
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
  function render(ORBS, yaw, tilt, fade) {
    let maxLit = 0; const now = performance.now() / 1000;
    ORBS.forEach((o, i) => {
      const t = orbs[i], z = o.depth < 1 ? -5 : 0, d = camera.position.z - z;
      const ppu = H / (2 * d * tan);
      t.outer.position.set((o.cx - W / 2) / ppu, -(o.cy - H / 2) / ppu, z);
      t.outer.scale.setScalar(o.R / ppu / MODEL_R);
      t.outer.rotation.y = yaw * o.spin + o.off;
      t.inner.rotation.set(tilt.x, 0, tilt.z);
      const L = o.lit * fade, K = t.dim, S = t.outer.scale.x;
      t.outer.updateMatrixWorld(); const c = t.outer.getWorldPosition(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse);
      for (const m of [t.core, t.glass]) { const u = m.uniforms; u.uC.value.copy(c); u.uR.value = MODEL_R * S; u.uLit.value = L; u.uDim.value = K; u.uT.value = now; u.uFade.value = fade; }
      t.core.uniforms.uGain.value = P.gain; for (const m of [t.core, t.glass]) { m.uniforms.uCtr.value = P.ctr; m.uniforms.uRim.value = P.rim; } t.glass.uniforms.uGain.value = P.glass;
      t.cu.uC.value.copy(c); t.cu.uR.value = MODEL_R * S; t.cu.uLit.value = L;
      t.chrome.envMapIntensity = (P.env0 + P.env1 * L) * fade * (0.4 + 0.6 * K);
      t.light.intensity = L * K * P.light * S * S * 0.07;
      t.warm.intensity = L * K * P.light * S * 0.3;
      t.halo.material.opacity = L * K * P.halo;
      maxLit = Math.max(maxLit, L);
    });
    bloom.strength = P.bloom * maxLit * (mobile ? 0.7 : 1);
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
