import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- helpers ----------
const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...opts });

function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
const box = (w, h, d, mat, o) => mesh(new THREE.BoxGeometry(w, h, d), mat, o);
const rbox = (w, h, d, r, mat, o) => mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, o);
const cyl = (rt, rb, h, mat, o, seg = 24) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, o);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- room shell ----------
export const ROOM = { half: 4, height: 4.2, wall: 0.2 };

export function buildRoom() {
  const g = new THREE.Group();
  const { half, height, wall } = ROOM;
  const size = half * 2;

  // wooden floor planks
  const floorTex = canvasTexture(1024, 1024, (ctx, w, h) => {
    const rows = 10;
    const ph = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -((r * 137) % 300);
      while (x < w) {
        const len = 260 + ((r * 31 + x) % 5) * 40;
        const l = 52 + ((r * 7 + Math.floor(x)) % 9);
        ctx.fillStyle = `hsl(28, 42%, ${l}%)`;
        ctx.fillRect(x, r * ph, len, ph);
        // grain
        ctx.strokeStyle = 'rgba(80,40,10,0.08)';
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          const yy = r * ph + 8 + i * (ph / 6);
          ctx.moveTo(x, yy);
          ctx.bezierCurveTo(x + len / 3, yy + 4, x + (2 * len) / 3, yy - 4, x + len, yy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(40,20,5,0.35)';
        ctx.fillRect(x, r * ph, 3, ph);
        x += len;
      }
      ctx.fillStyle = 'rgba(40,20,5,0.35)';
      ctx.fillRect(0, r * ph, w, 3);
    }
  });
  const floor = box(size, wall, size, std(0xffffff, { map: floorTex, roughness: 0.55 }), { y: -wall / 2, cast: false });
  g.add(floor);

  // walls (diorama style: back + left, open toward the camera)
  const wallMat = std(0xe9dfd0, { roughness: 0.95 });
  const back = box(size + wall, height, wall, wallMat, { x: -wall / 2, y: height / 2 - wall, z: -half - wall / 2 });
  const left = box(wall, height, size, wallMat, { x: -half - wall / 2, y: height / 2 - wall, z: 0 });
  g.add(back, left);

  // baseboards
  const trim = std(0xf7f2ea);
  g.add(box(size, 0.12, 0.03, trim, { y: 0.06, z: -half + 0.015 }));
  g.add(box(0.03, 0.12, size, trim, { x: -half + 0.015, y: 0.06 }));

  // window on the left wall with a night sky
  const sky = canvasTexture(512, 512, (ctx, w, h) => {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0b1030');
    grd.addColorStop(1, '#2b3a78');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
      const s = Math.random() * 2 + 0.5;
      ctx.fillRect(Math.random() * w, Math.random() * h * 0.8, s, s);
    }
    ctx.fillStyle = '#fff6d8';
    ctx.shadowColor = '#fff6d8';
    ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(w * 0.68, h * 0.28, 38, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // city silhouette
    ctx.fillStyle = '#080a1c';
    let x = 0;
    while (x < w) {
      const bw = 30 + Math.random() * 50, bh = 50 + Math.random() * 120;
      ctx.fillRect(x, h - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,200,100,0.7)';
      for (let k = 0; k < 6; k++) if (Math.random() > 0.5) ctx.fillRect(x + 6 + Math.random() * (bw - 12), h - bh + 10 + Math.random() * (bh - 20), 4, 5);
      ctx.fillStyle = '#080a1c';
      x += bw + 4;
    }
  });
  const win = new THREE.Group();
  win.position.set(-half + 0.01, 2.2, -1.6);
  win.rotation.y = Math.PI / 2;
  const frameMat = std(0xffffff, { roughness: 0.5 });
  win.add(mesh(new THREE.PlaneGeometry(1.8, 1.5), new THREE.MeshBasicMaterial({ map: sky }), { cast: false }));
  win.add(box(1.96, 0.08, 0.08, frameMat, { y: 0.79 }), box(1.96, 0.08, 0.08, frameMat, { y: -0.79 }));
  win.add(box(0.08, 1.66, 0.08, frameMat, { x: 0.94 }), box(0.08, 1.66, 0.08, frameMat, { x: -0.94 }));
  win.add(box(0.05, 1.5, 0.05, frameMat), box(1.8, 0.05, 0.05, frameMat));
  win.add(box(2.1, 0.06, 0.22, frameMat, { y: -0.84, z: 0.08 })); // sill
  g.add(win);

  // wall shelf with books
  const shelf = new THREE.Group();
  shelf.position.set(-2.1, 2.3, -half + 0.16);
  const wood = std(0x8a5a36, { roughness: 0.6 });
  shelf.add(box(1.6, 0.05, 0.3, wood));
  shelf.add(box(0.04, 0.2, 0.2, wood, { x: -0.6, y: -0.12 }), box(0.04, 0.2, 0.2, wood, { x: 0.6, y: -0.12 }));
  const bookCols = [0xc4553a, 0x2f3e6b, 0xe7a64a, 0x3c7a5a, 0x6b4f8a, 0xd9cdb8, 0x1f2433];
  let bx = -0.7;
  for (let i = 0; i < 9; i++) {
    const bw = 0.05 + (i % 3) * 0.015, bh = 0.26 + ((i * 7) % 5) * 0.03;
    shelf.add(box(bw, bh, 0.2, std(bookCols[i % bookCols.length]), { x: bx + bw / 2, y: 0.025 + bh / 2, rz: i === 8 ? 0.35 : 0 }));
    bx += bw + 0.008;
  }
  // tiny plant on the shelf
  shelf.add(cyl(0.07, 0.055, 0.13, std(0xd8d2c8), { x: 0.45, y: 0.09 }));
  for (let i = 0; i < 6; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.06, 10, 8), std(0x3c8a52), { x: 0.45 + Math.cos(i) * 0.04, y: 0.2 + (i % 3) * 0.03, z: Math.sin(i) * 0.04 });
    leaf.scale.set(0.6, 1.4, 0.6);
    leaf.rotation.z = Math.cos(i * 2) * 0.6;
    shelf.add(leaf);
  }
  g.add(shelf);

  // poster with name
  const posterTex = canvasTexture(512, 720, (ctx, w, h) => {
    ctx.fillStyle = '#1c2140'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffb54d'; ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath(); ctx.arc(w / 2, h * 0.42, 30 + i * 14, Math.PI * (0.1 * i), Math.PI * (0.1 * i + 1.1)); ctx.stroke();
    }
    ctx.fillStyle = '#f1ece4';
    ctx.font = 'bold 64px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUILD', w / 2, h * 0.82);
    ctx.font = '28px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#6fe3ff';
    ctx.fillText('things that move', w / 2, h * 0.9);
  });
  const poster = new THREE.Group();
  poster.position.set(2.85, 2.35, -half + 0.02);
  poster.add(box(0.98, 1.36, 0.03, std(0x111111)));
  poster.add(mesh(new THREE.PlaneGeometry(0.9, 1.27), std(0xffffff, { map: posterTex, roughness: 0.8 }), { z: 0.017, cast: false }));
  g.add(poster);

  // floor plant in the back corner
  const plant = new THREE.Group();
  plant.position.set(3.3, 0, -3.3);
  plant.add(cyl(0.28, 0.22, 0.5, std(0xc96f4a, { roughness: 0.9 }), { y: 0.25 }));
  plant.add(cyl(0.26, 0.26, 0.02, std(0x3a2a1c), { y: 0.5 }));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = mesh(new THREE.SphereGeometry(0.22, 12, 8), std(0x2f7a48, { roughness: 0.8 }), { x: Math.cos(a) * 0.18, y: 0.95 + (i % 3) * 0.18, z: Math.sin(a) * 0.18 });
    leaf.scale.set(0.45, 1.6, 0.25);
    leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    plant.add(leaf);
  }
  g.add(plant);

  return g;
}

// ---------- desk + monitor (YouTube video) ----------
export function buildDesk(project) {
  const g = new THREE.Group();
  g.position.set(0.8, 0, -ROOM.half + 0.5);

  const top = std(0xb98652, { roughness: 0.45 });
  const metal = std(0x22252e, { roughness: 0.4, metalness: 0.6 });
  g.add(rbox(2.0, 0.06, 0.85, 0.02, top, { y: 0.77 }));
  for (const sx of [-0.92, 0.92]) for (const sz of [-0.35, 0.35]) g.add(box(0.05, 0.74, 0.05, metal, { x: sx, y: 0.37, z: sz }));
  g.add(box(1.84, 0.04, 0.04, metal, { y: 0.15, z: -0.35 }));

  // monitor
  const mon = new THREE.Group();
  mon.position.set(0, 0.8, -0.12);
  mon.add(rbox(0.36, 0.02, 0.22, 0.01, metal, { y: 0.01 }));
  mon.add(box(0.06, 0.32, 0.03, metal, { y: 0.17, z: -0.05 }));
  const bezel = std(0x15161b, { roughness: 0.35 });
  mon.add(rbox(1.18, 0.7, 0.04, 0.015, bezel, { y: 0.66 }));

  const screenTex = canvasTexture(1280, 720, (ctx, w, h) => drawScreen(ctx, w, h, null));
  const screen = mesh(new THREE.PlaneGeometry(1.12, 0.63), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }), { y: 0.66, z: 0.021, cast: false });
  mon.add(screen);
  loadThumb(project, screenTex);
  // screen glow
  const screenLight = new THREE.PointLight(0x9fb6ff, 0.6, 2.2, 2);
  screenLight.position.set(0, 0.66, 0.35);
  mon.add(screenLight);
  g.add(mon);

  // keyboard + mouse + mug
  g.add(rbox(0.62, 0.025, 0.2, 0.01, std(0x2a2d38), { y: 0.815, z: 0.18 }));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++)
    g.add(box(0.036, 0.012, 0.034, std(0xd9d4ca), { x: -0.27 + c * 0.045, y: 0.832, z: 0.11 + r * 0.045, cast: false }));
  const mouse = mesh(new THREE.SphereGeometry(0.05, 16, 12), std(0x2a2d38), { x: 0.48, y: 0.81, z: 0.2 });
  mouse.scale.set(0.7, 0.35, 1);
  g.add(mouse);
  g.add(cyl(0.05, 0.045, 0.11, std(0xc4553a, { roughness: 0.4 }), { x: -0.72, y: 0.855, z: 0.1 }));
  const handle = mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16), std(0xc4553a, { roughness: 0.4 }), { x: -0.775, y: 0.86, z: 0.1, ry: Math.PI / 2 });
  g.add(handle);

  // desk lamp + warm light
  const lamp = new THREE.Group();
  lamp.position.set(-0.75, 0.8, -0.25);
  lamp.add(cyl(0.09, 0.1, 0.03, metal, { y: 0.015 }));
  lamp.add(cyl(0.012, 0.012, 0.45, metal, { y: 0.24, rz: 0.25 }));
  lamp.add(cyl(0.012, 0.012, 0.35, metal, { x: 0.1, y: 0.52, rz: -1.0 }));
  const shade = cyl(0.03, 0.1, 0.13, std(0xe7a64a, { roughness: 0.5, side: THREE.DoubleSide }), { x: 0.27, y: 0.56, rz: -0.6 }, 20);
  shade.geometry = new THREE.CylinderGeometry(0.03, 0.1, 0.13, 20, 1, true);
  lamp.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }), { x: 0.3, y: 0.52, cast: false });
  lamp.add(bulb);
  const lampLight = new THREE.PointLight(0xffc78a, 3.2, 4.5, 1.8);
  lampLight.position.set(0.3, 0.5, 0.05);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(512, 512);
  lampLight.shadow.bias = -0.004;
  lamp.add(lampLight);
  g.add(lamp);

  // chair
  const chair = new THREE.Group();
  chair.position.set(0.1, 0, 0.85);
  chair.rotation.y = 0.35;
  const fabric = std(0x2f3e6b, { roughness: 0.9 });
  chair.add(rbox(0.55, 0.08, 0.52, 0.03, fabric, { y: 0.5 }));
  chair.add(rbox(0.55, 0.62, 0.07, 0.03, fabric, { y: 0.88, z: 0.27, rx: -0.1 }));
  chair.add(cyl(0.035, 0.035, 0.38, metal, { y: 0.27 }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    chair.add(box(0.3, 0.03, 0.04, metal, { x: Math.cos(a) * 0.15, y: 0.06, z: Math.sin(a) * 0.15, ry: -a }));
    chair.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), metal, { x: Math.cos(a) * 0.29, y: 0.03, z: Math.sin(a) * 0.29 }));
  }
  g.add(chair);

  // anchor for the floating label + camera focus point
  const anchor = new THREE.Object3D();
  anchor.position.set(0, 1.62, -0.12);
  g.add(anchor);

  return { group: g, anchor, focus: new THREE.Vector3(0.8, 1.3, -ROOM.half + 0.4), lights: { lampLight } };
}

function drawScreen(ctx, w, h, img) {
  if (img) {
    // cover-fit thumbnail
    const s = Math.max(w / img.width, h / img.height);
    ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, w, h);
  } else {
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#1c2140');
    grd.addColorStop(1, '#3a1f3f');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f1ece4';
    ctx.font = 'bold 90px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Maker Portfolio', w / 2, h * 0.3);
  }
  // play button
  const cx = w / 2, cy = h / 2, bw = 220, bh = 154, r = 40;
  ctx.fillStyle = '#ff0033';
  ctx.beginPath();
  ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, r);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy - 40); ctx.lineTo(cx + 46, cy); ctx.lineTo(cx - 28, cy + 40);
  ctx.closePath(); ctx.fill();
}

function loadThumb(project, tex) {
  const tryLoad = (src, next) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // YouTube returns a 120x90 placeholder when maxres doesn't exist
      if (img.width < 200 && next) return tryLoad(next, null);
      const c = tex.image;
      drawScreen(c.getContext('2d'), c.width, c.height, img);
      tex.needsUpdate = true;
    };
    img.onerror = () => next && tryLoad(next, null);
    img.src = src;
  };
  tryLoad(project.thumbnail, project.thumbnailFallback);
}

// ---------- robot car (Raspberry Pi kit) ----------
export function buildCar() {
  const g = new THREE.Group(); // positioned/rotated by the animation
  const car = new THREE.Group(); // local model, front = +x
  car.scale.setScalar(1.8);
  g.add(car);

  const acrylic = std(0x111216, { roughness: 0.25, metalness: 0.1 });
  const brass = std(0xc9a24a, { roughness: 0.3, metalness: 0.9 });
  const yellow = std(0xffc21a, { roughness: 0.55 });
  const rubber = std(0x1a1a1a, { roughness: 0.95 });

  // two acrylic decks + standoffs
  car.add(rbox(0.46, 0.012, 0.22, 0.02, acrylic, { y: 0.1 }));
  car.add(rbox(0.42, 0.012, 0.21, 0.02, acrylic, { y: 0.17 }));
  for (const sx of [-0.18, 0.18]) for (const sz of [-0.09, 0.09]) car.add(cyl(0.006, 0.006, 0.07, brass, { x: sx, y: 0.135, z: sz }, 8));

  // yellow TT motors
  for (const sx of [-0.15, 0.15]) for (const sz of [-0.07, 0.07]) car.add(box(0.07, 0.035, 0.04, yellow, { x: sx, y: 0.075, z: sz }));

  // battery pack between decks
  car.add(box(0.14, 0.03, 0.08, std(0x0e0e10), { x: -0.03, y: 0.122 }));
  for (const sz of [-0.02, 0.02]) car.add(cyl(0.009, 0.009, 0.13, std(0x2d6ee0, { roughness: 0.4 }), { x: -0.03, y: 0.143, z: sz, rz: Math.PI / 2 }, 12));

  // wheels
  const wheels = [];
  for (const sx of [-0.15, 0.15]) for (const sz of [-1, 1]) {
    const wg = new THREE.Group();
    wg.position.set(sx, 0.065, sz * 0.135);
    const spin = new THREE.Group();
    wg.add(spin);
    spin.add(cyl(0.065, 0.065, 0.05, rubber, { rx: Math.PI / 2 }, 28));
    spin.add(cyl(0.046, 0.046, 0.054, yellow, { rx: Math.PI / 2 }, 20));
    // tread blocks so rotation is visible
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      spin.add(box(0.016, 0.008, 0.052, rubber, { x: Math.cos(a) * 0.066, y: Math.sin(a) * 0.066, rz: a, cast: false }));
    }
    // yellow spokes on the outside face
    for (let i = 0; i < 3; i++) spin.add(box(0.085, 0.01, 0.004, yellow, { z: sz * 0.028, rz: (i / 3) * Math.PI, cast: false }));
    car.add(wg);
    wheels.push(spin);
  }

  // Raspberry Pi + motor HAT
  const pcb = std(0x1f7a3f, { roughness: 0.45 });
  car.add(box(0.17, 0.008, 0.115, pcb, { x: -0.05, y: 0.182 }));
  car.add(box(0.16, 0.008, 0.11, std(0x12161c, { roughness: 0.4 }), { x: -0.05, y: 0.215 }));
  for (const sx of [-0.12, 0.02]) for (const sz of [-0.045, 0.045]) car.add(cyl(0.004, 0.004, 0.03, brass, { x: sx, y: 0.2, z: sz }, 6));
  const silver = std(0xcfd3da, { roughness: 0.25, metalness: 0.9 });
  car.add(box(0.035, 0.03, 0.03, silver, { x: -0.135, y: 0.2, z: -0.035 }));
  car.add(box(0.035, 0.03, 0.03, silver, { x: -0.135, y: 0.2, z: 0.0 }));
  car.add(box(0.035, 0.028, 0.032, silver, { x: -0.135, y: 0.2, z: 0.037 }));
  car.add(box(0.03, 0.004, 0.03, std(0x111111), { x: -0.05, y: 0.188, z: 0.01 }));
  // header pins
  car.add(box(0.1, 0.012, 0.012, std(0x101010), { x: -0.05, y: 0.226, z: -0.045 }));
  // ribbon cable to camera
  const ribbon = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.02, 0.22, 0), new THREE.Vector3(0.08, 0.3, 0), new THREE.Vector3(0.16, 0.27, 0),
    ]), 12, 0.006, 4),
    std(0xeeeeee, { roughness: 0.6 }));
  ribbon.scale.z = 3;
  car.add(ribbon);

  // RGB LEDs
  const ledColors = [0xff2244, 0x2266ff, 0x22ff88, 0xff22ee, 0xffcc22, 0x22ddff];
  const leds = [];
  const ledPos = [[0.2, 0.1, 0.1], [0.2, 0.1, -0.1], [-0.2, 0.1, 0.1], [-0.2, 0.1, -0.1], [0.02, 0.222, 0.05], [-0.1, 0.222, -0.05]];
  ledPos.forEach((p, i) => {
    const m = new THREE.MeshBasicMaterial({ color: ledColors[i % ledColors.length], toneMapped: false });
    const led = mesh(new THREE.SphereGeometry(0.009, 10, 8), m, { x: p[0], y: p[1], z: p[2], cast: false });
    led.userData.noHighlight = true;
    car.add(led);
    leds.push(led);
  });
  const underglow = new THREE.PointLight(0x6688ff, 0.5, 0.8, 2);
  underglow.position.set(0, 0.05, 0);
  car.add(underglow);

  // pan-tilt head with ultrasonic sensor + camera
  const pan = new THREE.Group();
  pan.position.set(0.17, 0.18, 0);
  car.add(pan);
  pan.add(box(0.03, 0.04, 0.035, std(0x14161c), { y: 0.02 }));
  const tilt = new THREE.Group();
  tilt.position.set(0, 0.05, 0);
  pan.add(tilt);
  tilt.add(box(0.012, 0.06, 0.1, std(0x14161c), { x: 0.0, y: 0.02 }));
  tilt.add(box(0.008, 0.04, 0.09, std(0x2f5fb8, { roughness: 0.5 }), { x: 0.012, y: 0.04 }));
  for (const sz of [-0.026, 0.026]) {
    tilt.add(cyl(0.016, 0.016, 0.02, silver, { x: 0.025, y: 0.04, z: sz, rz: Math.PI / 2 }, 16));
    tilt.add(cyl(0.012, 0.012, 0.021, std(0x333333, { roughness: 0.9 }), { x: 0.026, y: 0.04, z: sz, rz: Math.PI / 2, cast: false }, 16));
  }
  tilt.add(box(0.01, 0.022, 0.022, std(0x111111), { x: 0.012, y: 0.0 }));
  tilt.add(cyl(0.006, 0.006, 0.012, std(0x050505, { roughness: 0.1, metalness: 0.5 }), { x: 0.02, y: 0.0, rz: Math.PI / 2 }, 12));

  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0.55, 0);
  g.add(anchor);

  return { group: g, anchor, wheels, leds, ledColors, pan, tilt, wheelRadius: 0.065 * 1.8 };
}

// ---------- protein display stand ----------
export function buildProteinStand() {
  const g = new THREE.Group();
  g.position.set(-2.75, 0, 1.3);

  const white = std(0xf2eee8, { roughness: 0.35 });
  g.add(rbox(0.8, 0.95, 0.8, 0.04, white, { y: 0.475 }));
  g.add(rbox(0.86, 0.05, 0.86, 0.02, std(0x1c2140, { roughness: 0.3 }), { y: 0.97 }));
  // little plaque
  const plaqueTex = canvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#1c2140'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f1ece4';
    ctx.font = 'bold 54px "Space Grotesk", sans-serif';
    ctx.fillText('Hexokinase', 28, 70);
    ctx.fillStyle = '#6fe3ff';
    ctx.font = '32px "Space Grotesk", sans-serif';
    ctx.fillText('proteomics · DMA', 28, 125);
  });
  g.add(mesh(new THREE.PlaneGeometry(0.5, 0.156), std(0xffffff, { map: plaqueTex, roughness: 0.4 }), { y: 0.72, z: 0.401, cast: false }));

  // glowing ring the protein floats over
  const ring = mesh(new THREE.TorusGeometry(0.33, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: 0x6fe3ff, toneMapped: false }), { y: 1.0, rx: Math.PI / 2, cast: false });
  ring.userData.noHighlight = true;
  g.add(ring);
  const spot = new THREE.PointLight(0x6fe3ff, 1.4, 2.5, 2);
  spot.position.set(0, 1.15, 0.2);
  g.add(spot);

  // the protein lives in here once loaded
  const holder = new THREE.Group();
  holder.position.set(0, 1.72, 0);
  g.add(holder);

  // placeholder orb while the model downloads
  const placeholder = mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshStandardMaterial({ color: 0x6fe3ff, wireframe: true }), { cast: false });
  holder.add(placeholder);

  const anchor = new THREE.Object3D();
  anchor.position.set(0, 2.45, 0);
  g.add(anchor);

  return { group: g, anchor, holder, placeholder, focus: new THREE.Vector3(-2.75, 1.5, 1.3) };
}

// Fit a loaded protein scene into the holder
export function mountProtein(holder, placeholder, scene) {
  const palette = [0x6fe3ff, 0xff7aa8, 0xffb54d];
  let i = 0;
  scene.traverse((o) => {
    if (o.isMesh) {
      o.material = new THREE.MeshStandardMaterial({
        color: palette[i % palette.length],
        roughness: 0.35,
        metalness: 0.1,
        emissive: palette[i % palette.length],
        emissiveIntensity: 0.12,
        side: THREE.DoubleSide,
      });
      o.castShadow = true;
      i++;
    }
  });
  const bbox = new THREE.Box3().setFromObject(scene);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  scene.position.sub(center);
  wrapper.add(scene);
  wrapper.scale.setScalar(1.15 / Math.max(size.x, size.y, size.z));
  holder.remove(placeholder);
  holder.add(wrapper);
}

// ---------- cone track the robot car follows ----------
// Closed loop on the floor (x, z). Blue cones on the car's left, red on its right — like the real demo.
const TRACK_POINTS = [
  [-1.2, 0.2], [0.2, -0.9], [1.9, -0.7], [3.0, 0.5], [2.6, 1.7],
  [1.5, 1.6], [0.7, 2.6], [-0.5, 3.1], [-1.5, 2.0],
];

export function buildConeTrack({ halfWidth = 0.48, spacing = 0.5 } = {}) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(
    TRACK_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal'
  );
  const length = curve.getLength();

  // dense centreline samples, used to drop cones that would sit on the road at tight bends
  const centre = curve.getSpacedPoints(400);
  const clearOfRoad = (p) => centre.every((c) => c.distanceToSquared(p) > (halfWidth * 0.8) ** 2);

  const plastic = (color) => std(color, { roughness: 0.35 });
  const blueMat = plastic(0x1f6bff);
  const redMat = plastic(0xff2a2a);
  const coneGeo = new THREE.CylinderGeometry(0.018, 0.075, 0.2, 20);
  coneGeo.translate(0, 0.11, 0);
  const tipGeo = new THREE.SphereGeometry(0.02, 12, 8);
  tipGeo.translate(0, 0.21, 0);
  const baseGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.014, 24);
  baseGeo.translate(0, 0.007, 0);

  const placed = [];
  const count = Math.floor(length / spacing);
  const tan = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = i / count;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, tan);
    const left = new THREE.Vector3(tan.z, 0, -tan.x).normalize(); // car's left when heading along +u
    for (const [side, mat] of [[1, blueMat], [-1, redMat]]) {
      const c = p.clone().addScaledVector(left, side * halfWidth);
      if (!clearOfRoad(c) || placed.some((q) => q.distanceToSquared(c) < 0.3 * 0.3)) continue;
      placed.push(c);
      const cone = new THREE.Group();
      cone.position.copy(c);
      for (const geo of [coneGeo, tipGeo, baseGeo]) {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = m.receiveShadow = true;
        cone.add(m);
      }
      g.add(cone);
    }
  }
  return { group: g, curve, length };
}
