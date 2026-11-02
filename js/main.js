import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PROJECTS } from './projects.js';
import { buildRoom, buildDesk, buildCar, buildProteinStand, mountProtein, buildConeTrack } from './room.js';

const $ = (s) => document.querySelector(s);
const byId = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= Viewer (pop-up with iframe) ================= */
const viewer = $('#viewer');
const frame = $('#viewer-frame');
const body = viewer.querySelector('.viewer-body');
let current = null;
let closeTimer = 0;

function showViewer(p) {
  clearTimeout(closeTimer);
  current = p;
  $('#viewer-title').textContent = p.title;
  $('#viewer-sub').textContent = p.subtitle;
  $('#viewer-ext').href = p.external;
  body.classList.toggle('video', !!p.video);
  body.classList.remove('loaded');
  frame.title = p.title;
  frame.src = p.url;
  viewer.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => viewer.classList.add('open')));
  document.title = `${p.title} · Kaya Topbaş`;
  setTimeout(() => viewer.querySelector('.back-btn').focus({ preventScroll: true }), 50);
}

function hideViewer() {
  if (!current) return;
  current = null;
  viewer.classList.remove('open');
  document.title = 'Kaya Topbaş · Portfolio';
  closeTimer = setTimeout(() => {
    viewer.hidden = true;
    frame.src = 'about:blank'; // stops video/audio
  }, reducedMotion ? 0 : 350);
  onViewerClosed();
}

frame.addEventListener('load', () => {
  if (frame.src !== 'about:blank') body.classList.add('loaded');
});

// History integration: phone back button / swipe-back closes the pop-up
function openProject(id, { push = true } = {}) {
  const p = byId[id];
  if (!p) return;
  closeMenus();
  if (push) history.pushState({ project: id }, '', `#${id}`);
  // only show if the user didn't press back during the camera flight
  focusCamera(id, () => {
    if (location.hash.slice(1) === id) showViewer(p);
  });
}

function requestClose() {
  if (history.state && history.state.project) history.back();
  else {
    history.replaceState(null, '', location.pathname + location.search);
    hideViewer();
  }
}

addEventListener('popstate', () => {
  const id = location.hash.slice(1);
  if (byId[id]) openProject(id, { push: false });
  else hideViewer();
});

viewer.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) requestClose();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (current) requestClose();
    else closeMenus();
  }
});

/* ================= Menus ================= */
const menu = $('#menu');
const credits = $('#credits');
const menuBtn = $('#menu-btn');
$('#menu-list').innerHTML = PROJECTS.map(
  (p) => `<li><button data-project="${p.id}"><strong>${p.label}</strong><span>${p.subtitle}</span></button></li>`
).join('');
menu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-project]');
  if (b) openProject(b.dataset.project);
});
function closeMenus() {
  menu.hidden = true;
  credits.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
}
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = menu.hidden;
  closeMenus();
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
});
$('#info-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const open = credits.hidden;
  closeMenus();
  credits.hidden = !open;
});
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.menu, .chip')) closeMenus();
});

/* ================= 3D scene ================= */
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  console.warn('WebGL unavailable', err);
}

let focusCamera = (id, done) => done();
let onViewerClosed = () => {};

if (!renderer) {
  document.body.classList.add('no-webgl');
  menu.hidden = false;
  $('#loader').classList.add('done');
} else {
  initScene();
}

// open a deep link like /#car after everything is set up
if (byId[location.hash.slice(1)]) {
  history.replaceState({ project: location.hash.slice(1) }, '', location.hash);
  setTimeout(() => openProject(location.hash.slice(1), { push: false }), 400);
}

function initScene() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x3a2a20, 0.9));
  const moon = new THREE.DirectionalLight(0xa8bcff, 1.4);
  moon.position.set(-8, 9, 3);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  moon.shadow.bias = -0.0005;
  moon.shadow.normalBias = 0.02;
  scene.add(moon);
  const fill = new THREE.DirectionalLight(0xffe2c4, 0.6);
  fill.position.set(6, 6, 8);
  scene.add(fill);

  // ---- objects ----
  scene.add(buildRoom());
  const desk = buildDesk(byId.video);
  const car = buildCar();
  const protein = buildProteinStand();
  const track = buildConeTrack();
  scene.add(desk.group, car.group, protein.group, track.group);

  // interactive targets (for raycasting + highlight)
  const targets = [
    { id: 'video', group: desk.group, anchor: desk.anchor, focus: desk.focus, dist: 2.6 },
    { id: 'car', group: car.group, extra: [track.group], anchor: car.anchor, focus: null, dist: 2.3 },
    { id: 'proteomics', group: protein.group, anchor: protein.anchor, focus: protein.focus, dist: 2.6 },
  ];
  const groupsOf = (t) => [t.group, ...(t.extra || [])];
  targets.forEach((t) => groupsOf(t).forEach((g) => g.traverse((o) => (o.userData.project = t.id))));
  const pickables = targets.flatMap(groupsOf);

  // ---- floating labels ----
  const labelsEl = $('#labels');
  targets.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'hotspot';
    b.innerHTML = `<span class="dot"></span>${byId[t.id].label}`;
    b.addEventListener('click', () => openProject(t.id));
    b.addEventListener('pointerenter', () => setHover(t.id));
    b.addEventListener('pointerleave', () => setHover(null));
    labelsEl.appendChild(b);
    t.label = b;
  });

  // ---- protein model (big file — show progress) ----
  const loaderEl = $('#loader');
  const bar = $('#loader-bar');
  const pct = $('#loader-pct');
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    loaderEl.classList.add('done');
  };
  new GLTFLoader().load(
    'assets/protein.glb',
    (gltf) => {
      mountProtein(protein.holder, protein.placeholder, gltf.scene);
      protein.group.traverse((o) => (o.userData.project = 'proteomics'));
      bar.style.width = '100%';
      reveal();
    },
    (e) => {
      if (e.lengthComputable) {
        const v = Math.round((e.loaded / e.total) * 100);
        bar.style.width = v + '%';
        pct.textContent = v + '%';
      }
    },
    (err) => {
      console.error('protein failed to load', err);
      reveal();
    }
  );
  // don't keep people waiting forever on slow connections — the placeholder shows meanwhile
  setTimeout(reveal, 8000);

  // ---- camera + controls ----
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.35;
  controls.minAzimuthAngle = -0.15;
  controls.maxAzimuthAngle = Math.PI / 2 + 0.15;
  controls.minDistance = 3;
  controls.maxDistance = 22;

  const home = { target: new THREE.Vector3(0, 1.1, -0.3), pos: new THREE.Vector3() };
  function computeHome() {
    const portrait = camera.aspect < 1;
    camera.fov = portrait ? 55 : 40;
    camera.updateProjectionMatrix();
    // pull back further on narrow screens so the whole room fits
    const dist = portrait ? 13.5 / Math.max(camera.aspect, 0.45) * 0.72 : 13.5;
    home.target.y = portrait ? 0.5 : 1.1;
    const dir = new THREE.Vector3(1, 0.82, 1).normalize();
    home.pos.copy(home.target).addScaledVector(dir, dist);
    controls.maxDistance = Math.max(22, dist * 1.4);
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const wasHome = !tween && !current && camera.position.distanceTo(home.pos) < 0.01;
    computeHome();
    if (wasHome || !started) {
      camera.position.copy(home.pos);
      controls.target.copy(home.target);
    }
  }
  let started = false;
  let tween = null;
  resize();
  started = true;
  addEventListener('resize', resize);

  // ---- camera tweens ----
  const saved = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function tweenTo(pos, target, ms, done) {
    if (reducedMotion) ms = 0;
    tween = {
      fromPos: camera.position.clone(), fromTarget: controls.target.clone(),
      toPos: pos.clone(), toTarget: target.clone(),
      t0: performance.now(), ms, done,
    };
    controls.enabled = false;
  }

  focusCamera = (id, done) => {
    const t = targets.find((x) => x.id === id);
    if (!current) {
      saved.pos.copy(camera.position);
      saved.target.copy(controls.target);
    }
    const focus = t.focus ? t.focus.clone() : t.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0));
    const dir = camera.position.clone().sub(focus);
    dir.y = Math.max(dir.y, dir.length() * 0.35);
    dir.normalize();
    const dist = camera.aspect < 1 ? t.dist * 1.6 : t.dist;
    tweenTo(focus.clone().addScaledVector(dir, dist), focus, 750, done);
  };

  onViewerClosed = () => {
    tweenTo(saved.pos, saved.target, 750, null);
  };

  // ---- picking (tap vs drag) ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  let hovered = null;

  function pick(clientX, clientY) {
    ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables, true)[0];
    return hit ? hit.object.userData.project : null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    hideHint();
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || current || tween) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved < 10 && quick) {
      const id = pick(e.clientX, e.clientY);
      if (id) openProject(id);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    setHover(pick(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointerleave', () => setHover(null));

  function setHover(id) {
    if (hovered === id) return;
    if (hovered) highlight(hovered, false);
    hovered = id;
    if (id) highlight(id, true);
    canvas.style.cursor = id ? 'pointer' : 'grab';
    targets.forEach((t) => t.label.classList.toggle('active', t.id === id));
  }

  const glowColor = new THREE.Color(0x3a2a10);
  function highlight(id, on) {
    groupsOf(targets.find((t) => t.id === id)).forEach((g) => g.traverse((o) => {
      if (!o.isMesh || o.userData.noHighlight || !o.material.emissive) return;
      const m = o.material;
      if (!m.userData.base) m.userData.base = m.emissive.clone();
      m.emissive.copy(m.userData.base);
      if (on) m.emissive.add(glowColor);
    }));
  }

  const hint = $('#hint');
  let hintHidden = false;
  function hideHint() {
    if (hintHidden) return;
    hintHidden = true;
    setTimeout(() => hint.classList.add('hide'), 2500);
  }

  // ---- animation loop ----
  const clock = new THREE.Clock();
  let carU = 0; // 0..1 along the cone track
  const carTan = new THREE.Vector3();
  const aheadTan = new THREE.Vector3();
  const v = new THREE.Vector3();
  const tmpColor = new THREE.Color();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    // camera tween
    if (tween) {
      const k = tween.ms ? Math.min((performance.now() - tween.t0) / tween.ms, 1) : 1;
      const e = ease(k);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
      if (k >= 1) {
        const done = tween.done;
        tween = null;
        controls.enabled = !current;
        if (done) done();
        if (!current) controls.enabled = true;
      }
    }

    // pause the heavy render while a project is open (saves phone battery)
    if (current && !tween && viewer.classList.contains('open')) {
      labelsEl.style.visibility = 'hidden';
      return;
    }
    labelsEl.style.visibility = '';

    // car follows the cone track (slows down when hovered, stops while a project is open)
    const speed = current || tween ? 0 : hovered === 'car' ? 0.15 : 0.55; // metres / second
    carU = (carU + (dt * speed) / track.length) % 1;
    track.curve.getPointAt(carU, car.group.position);
    track.curve.getTangentAt(carU, carTan);
    car.group.rotation.y = Math.atan2(-carTan.z, carTan.x);
    car.wheels.forEach((w) => (w.rotation.z -= (dt * speed) / car.wheelRadius));
    // the sensor head looks into the upcoming bend, like it's tracking the next cones
    track.curve.getTangentAt((carU + 0.04) % 1, aheadTan);
    const turn = Math.atan2(carTan.x * aheadTan.z - carTan.z * aheadTan.x, carTan.dot(aheadTan));
    car.pan.rotation.y += (THREE.MathUtils.clamp(-turn * 2.2, -0.7, 0.7) - car.pan.rotation.y) * Math.min(dt * 4, 1);
    car.tilt.rotation.z = -0.12 + Math.sin(time * 0.8) * 0.05;
    car.leds.forEach((led, i) => {
      tmpColor.setHSL((time * 0.15 + i / car.leds.length) % 1, 1, 0.55);
      led.material.color.copy(tmpColor);
    });

    // protein floats and spins
    protein.holder.rotation.y += dt * 0.35;
    protein.holder.position.y = 1.72 + Math.sin(time * 1.2) * 0.04;

    controls.update();
    renderer.render(scene, camera);

    // labels follow their anchors
    const showLabels = !current && !tween;
    targets.forEach((t) => {
      t.anchor.getWorldPosition(v);
      v.project(camera);
      const visible = showLabels && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      t.label.classList.toggle('hidden', !visible);
      if (visible) {
        const x = (v.x * 0.5 + 0.5) * innerWidth;
        const y = (-v.y * 0.5 + 0.5) * innerHeight;
        t.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    });
  });
}
