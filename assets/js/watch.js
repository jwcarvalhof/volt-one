/* VOLT One · modelo 3D procedural
   Cada componente é um objeto Three.js separado e nomeado (glass, bezel, display,
   pcb, battery, back, case, strapTop, strapBottom). A desmontagem anima a posição
   de cada peça ao longo do eixo da tela (Z local), então nada aqui é imagem plana.

   PARA TROCAR POR UM MODELO GLB REAL: carregue o arquivo com GLTFLoader e associe
   os nós do GLB aos mesmos nomes de PART_NAMES. A coreografia em app.js só lê
   `parts[i].position.z`, então ela continua funcionando sem mudanças.

   Também aqui: a cena do chip (chipSet), usada como fundo das Especificações. */

import * as THREE from '../vendor/three.bundle.min.js';

const D2R = Math.PI / 180;
export const PART_NAMES = ['glass', 'bezel', 'display', 'pcb', 'battery', 'back'];
export const OFFSETS = [3.1, 2.35, 1.6, 0.9, 0.44, -1.05];
const ANCHORS = [
  [0.86, 0.0, 0.26], [0.99, 0.0, 0.2], [0.85, 0.0, 0.17],
  [0.74, 0.12, 0.05], [0.52, 0.0, -0.03], [0.88, 0.0, -0.2]
];
const BG = [4 / 255, 6 / 255, 12 / 255];
const BG2 = [6 / 255, 6 / 255, 8 / 255]; // #060608, preto suave da seção de detalhes

/* ---------- utilidades ---------- */
function roundPoly(pts, r = 0.016, seg = 4) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i === 0 || i === pts.length - 1 || r <= 0) { out.push(new THREE.Vector2(p[0], p[1])); continue; }
    const a = pts[i - 1], b = pts[i + 1];
    const va = [a[0] - p[0], a[1] - p[1]], vb = [b[0] - p[0], b[1] - p[1]];
    const la = Math.hypot(va[0], va[1]), lb = Math.hypot(vb[0], vb[1]);
    const d = Math.min(r, la * 0.45, lb * 0.45);
    const p1 = [p[0] + va[0] / la * d, p[1] + va[1] / la * d];
    const p2 = [p[0] + vb[0] / lb * d, p[1] + vb[1] / lb * d];
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, u = 1 - t;
      out.push(new THREE.Vector2(u * u * p1[0] + 2 * u * t * p[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * p[1] + t * t * p2[1]));
    }
  }
  return out;
}
function lathe(pts, segs = 200, r = 0.016) {
  const g = new THREE.LatheGeometry(roundPoly(pts, r), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- estúdio: softboxes que aparecem nos reflexos do metal e do vidro ---------- */
function studioEnvironment(renderer) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x03050a, side: THREE.BackSide }));
  s.add(room);
  const box = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); s.add(m);
  };
  box(16, 2.2, 0xffffff, 7, [0, 11, 1], [0, 0, 0]);          // faixa superior longa
  box(3, 13, 0xe9efff, 5, [-12, 1, 4], [0, 0, 0]);            // softbox principal à esquerda
  box(1.1, 14, 0xffffff, 6, [12, 0, 2], [0, 0, 0]);           // risco fino à direita
  box(5, 9, 0x2f6bff, 6, [-8, 0, -11], [0, 0, 0]);            // contraluz azul
  box(14, 1.2, 0x9fb8ff, 0.6, [0, -9, 9], [0, 0, 0]);         // rebatedor baixo
  box(2.2, 2.2, 0xffffff, 0.8, [9, 8, 9], [0, 0, 0]);         // reflexo pontual, fora do eixo da tela
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return tex;
}

/* ---------- texturas ---------- */
function brushedTexture(seed, w = 1024, h = 256, base = 96) {
  const t = canvasTex(w, h, (x) => {
    x.fillStyle = `rgb(${base},${base},${base})`; x.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let i = 0; i < 5200; i++) {
      const y = r() * h, x0 = r() * w, len = 60 + r() * 700, v = r() > 0.5 ? base + 30 + r() * 40 : base - 30 - r() * 30;
      x.strokeStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.12})`; x.lineWidth = 0.6 + r() * 0.8;
      x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + len, y + (r() - 0.5) * 0.6); x.stroke();
    }
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function pcbTexture() {
  return canvasTex(1024, 1024, (x, W) => {
    x.fillStyle = '#0a1322'; x.fillRect(0, 0, W, W);
    const r = rng(7); x.lineCap = 'round';
    for (let i = 0; i < 160; i++) {
      x.strokeStyle = r() > 0.82 ? 'rgba(184,145,74,.6)' : 'rgba(40,70,120,.6)';
      x.lineWidth = 2 + r() * 3;
      let px = r() * W, py = r() * W; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 3; k++) { if (r() > 0.5) px += (r() - 0.5) * 360; else py += (r() - 0.5) * 360; x.lineTo(px, py); }
      x.stroke();
    }
    for (let i = 0; i < 110; i++) { x.fillStyle = 'rgba(200,160,90,.8)'; x.beginPath(); x.arc(r() * W, r() * W, 3 + r() * 4, 0, Math.PI * 2); x.fill(); }
  });
}
function bezelBump() {
  const t = canvasTex(2048, 64, (x, W, H) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) {
      const px = (i / 120) * W;
      x.fillStyle = i % 10 === 0 ? '#2e2e2e' : '#585858';
      x.fillRect(px - (i % 10 === 0 ? 3 : 1.5), H * 0.6, i % 10 === 0 ? 6 : 3, H * 0.22);
    }
  }, false);
  return t;
}
function backTextTexture(text) {
  return canvasTex(1024, 1024, (x, W) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, W, W); x.translate(W / 2, W / 2);
    x.fillStyle = '#fff'; x.font = '600 44px Inter, Arial, sans-serif';
    const radius = 420; let ang = -Math.PI / 2;
    const total = [...text].reduce((a, ch) => a + x.measureText(ch).width + 6, 0);
    const scale = (Math.PI * 2 * radius) / total;
    for (const ch of text) {
      const w = (x.measureText(ch).width + 6) * scale;
      x.save(); x.rotate(ang + w / radius / 2 + Math.PI / 2); x.translate(0, -radius); x.fillText(ch, -x.measureText(ch).width / 2, 0); x.restore();
      ang += w / radius;
    }
    x.strokeStyle = '#fff'; x.lineWidth = 3;
    x.beginPath(); x.arc(0, 0, 470, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(0, 0, 365, 0, Math.PI * 2); x.stroke();
  }, false);
}
function strapTextures(holes) {
  // mapa de cor + relevo: grão fino de borracha, canaletas e furos
  const draw = (bump) => (x, W, H) => {
    x.fillStyle = bump ? '#9a9a9a' : '#ffffff'; x.fillRect(0, 0, W, H);
    const r = rng(holes ? 3 : 5);
    for (let i = 0; i < 9000; i++) { const v = bump ? (r() > 0.5 ? 180 : 60) : 0; x.fillStyle = bump ? `rgba(${v},${v},${v},.18)` : `rgba(0,0,0,${r() * 0.04})`; x.fillRect(r() * W, r() * H, 1.5, 1.5); }
    x.fillStyle = bump ? '#5a5a5a' : 'rgba(0,0,0,.14)';
    x.fillRect(W * 0.1, 0, W * 0.012, H); x.fillRect(W * 0.388, 0, W * 0.012, H);
    if (holes) for (let i = 0; i < 7; i++) {
      const cy = H * (0.6 + i * 0.048);
      x.fillStyle = bump ? '#000' : '#0b0d12';
      x.beginPath(); x.ellipse(W * 0.25, cy, W * 0.045, H * 0.01, 0, 0, Math.PI * 2); x.fill();
      if (!bump) { x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 2; x.stroke(); }
    }
  };
  const map = canvasTex(256, 1024, draw(false));
  const bump = canvasTex(256, 1024, draw(true), false);
  return { map, bump };
}
function glowTexture(inner = 'rgba(255,255,255,1)') {
  return canvasTex(128, 128, (x, W) => {
    const g = x.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    g.addColorStop(0, inner); g.addColorStop(0.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, W);
  });
}

/* ---------- pulseiras ---------- */
function strapGeometry(points, width, thick, segs = 160) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(0, p[0], p[1])), false, 'centripetal');
  const ht = thick / 2, rr = Math.min(ht * 0.95, 0.05);
  const ring = 26; // pontos por seção
  const section = (hw) => {
    const cs = [];
    const corner = (cx, cy, a0) => { for (let k = 0; k <= 5; k++) { const a = a0 + (k / 5) * Math.PI / 2; cs.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } };
    cs.push([0, ht]);
    corner(-hw + rr, ht - rr, Math.PI / 2); corner(-hw + rr, -ht + rr, Math.PI);
    corner(hw - rr, -ht + rr, Math.PI * 1.5); corner(hw - rr, ht - rr, 0);
    cs.push([0, ht]);
    return cs;
  };
  const pos = [], uv = [], idx = [];
  const X = new THREE.Vector3(1, 0, 0), N = new THREE.Vector3(), T = new THREE.Vector3(), P = new THREE.Vector3();
  const C = new THREE.Vector3(0, 0, -1.15);
  let ringLen = 0;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P); curve.getTangentAt(t, T);
    N.crossVectors(X, T).normalize();
    if (N.dot(P.clone().sub(C)) < 0) N.negate();
    // afina em direção à ponta, como uma pulseira de verdade
    const taper = 1 - 0.14 * THREE.MathUtils.smoothstep(t, 0.55, 1);
    const cs = section(width / 2 * taper);
    ringLen = cs.length;
    const lens = [0]; for (let k = 1; k < cs.length; k++) lens.push(lens[k - 1] + Math.hypot(cs[k][0] - cs[k - 1][0], cs[k][1] - cs[k - 1][1]));
    const perim = lens[lens.length - 1];
    for (let j = 0; j < cs.length; j++) {
      const [sx, st] = cs[j];
      pos.push(P.x + X.x * sx + N.x * st, P.y + X.y * sx + N.y * st, P.z + X.z * sx + N.z * st);
      uv.push(((lens[j] / perim) + 0.25 - (width / 2 * taper / perim)) % 1, t);
    }
  }
  void ring;
  for (let i = 0; i < segs; i++) for (let j = 0; j < ringLen - 1; j++) {
    const a = i * ringLen + j, b = a + ringLen, c = b + 1, d = a + 1;
    idx.push(a, b, d, b, c, d);
  }
  const endC = pos.length / 3; curve.getPointAt(1, P); pos.push(P.x, P.y, P.z); uv.push(0.5, 1);
  for (let j = 0; j < ringLen - 1; j++) idx.push(endC, segs * ringLen + j + 1, segs * ringLen + j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return { geo: g, curve };
}

/* ---------- cena do chip (fundo das Especificações) ---------- */
function traceTexture() {
  return canvasTex(2048, 2048, (x, W) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, W, W);
    const r = rng(21), c = W / 2, cw = W * 0.105, ch = W * 0.08;
    x.lineCap = 'round'; x.lineJoin = 'round';
    // malha fina (canal azul escuro)
    x.strokeStyle = 'rgba(0,0,255,.5)'; x.lineWidth = 1;
    for (let i = 0; i < 260; i++) { const y = r() * W; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y + (r() - 0.5) * 40); x.stroke(); }
    // trilhas radiais saindo do chip (vermelho = azul-claro, verde = dourado)
    for (let i = 0; i < 420; i++) {
      const side = Math.floor(r() * 4), s = r() * 2 - 1;
      let px, py, dx, dy;
      if (side === 0) { px = c + s * cw; py = c - ch; dx = 0; dy = -1; }
      else if (side === 1) { px = c + s * cw; py = c + ch; dx = 0; dy = 1; }
      else if (side === 2) { px = c - cw; py = c + s * ch; dx = -1; dy = 0; }
      else { px = c + cw; py = c + s * ch; dx = 1; dy = 0; }
      const gold = r() > 0.82;
      x.strokeStyle = gold ? 'rgba(0,255,0,1)' : `rgba(255,0,0,${0.55 + r() * 0.45})`;
      x.lineWidth = gold ? 2.2 : 1.2 + r() * 2.2;
      x.beginPath(); x.moveTo(px, py);
      let len = 60 + r() * 120;
      for (let k = 0; k < 4; k++) {
        px += dx * len; py += dy * len; x.lineTo(px, py);
        // dobra a 45 graus e volta para a direção original
        const bend = r() > 0.5 ? 1 : -1, b = 30 + r() * 80;
        if (dx === 0) { px += bend * b; py += dy * b; } else { px += dx * b; py += bend * b; }
        x.lineTo(px, py);
        len = 40 + r() * 200 * (k + 1) * 0.6;
      }
      x.stroke();
      x.fillStyle = gold ? 'rgba(0,255,0,1)' : 'rgba(255,0,0,1)';
      x.beginPath(); x.arc(px, py, gold ? 5 : 4, 0, Math.PI * 2); x.fill();
    }
  }, false);
}
function buildChipSet(mat) {
  const set = new THREE.Group(); set.name = 'chipSet';
  const uni = { uMap: { value: traceTexture() }, uTime: { value: 0 }, uI: { value: 1 } };
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D uMap; uniform float uTime; uniform float uI; varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        vec2 p = vUv - 0.5; float r = length(p) * 2.0;
        float ph = fract(uTime * 0.09);
        float w = exp(-pow((r - ph * 1.25) / 0.07, 2.0)) + 0.6 * exp(-pow((r - fract(ph + 0.5) * 1.25) / 0.09, 2.0));
        float fall = smoothstep(0.9, 0.08, r);
        vec3 bg = vec3(${BG.join(',')});
        vec3 blue = vec3(0.56, 0.74, 1.0), gold = vec3(1.0, 0.6, 0.26);
        vec3 col = bg + vec3(0.006, 0.012, 0.03) * t.b * fall
                 + blue * t.r * (0.07 + 1.9 * w) * fall * fall * uI
                 + gold * t.g * (0.05 + 1.1 * w) * fall * fall * uI;
        gl_FragColor = vec4(col, 1.0);
      }`
  }));
  board.rotation.x = -Math.PI / 2; set.add(board);
  // chip
  const chip = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.95, 0.12, 0.72, 3, 0.03), new THREE.MeshPhysicalMaterial({ color: 0x1b2232, metalness: 0.7, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.15 }));
  chip.position.y = 0.07; set.add(chip);
  const lid = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.78, 0.02, 0.56, 2, 0.01), new THREE.MeshPhysicalMaterial({ color: 0x8e98a8, metalness: 1, roughness: 0.22 }));
  lid.position.y = 0.135; set.add(lid);
  // halo retangular em volta do chip
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.45), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: uni,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
      void main(){
        vec2 p = (vUv - 0.5) * vec2(1.7, 1.45);
        float d = sdBox(p, vec2(0.475, 0.36)) - 0.02;
        float g = exp(-max(d, 0.0) * 22.0) * smoothstep(-0.02, 0.005, d);
        float pulse = 0.82 + 0.18 * sin(uTime * 1.4);
        gl_FragColor = vec4(vec3(0.62, 0.78, 1.0) * g * pulse * 1.3, 1.0);
      }`
  }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.012; set.add(halo);
  // pinos
  const pinG = new THREE.BoxGeometry(0.018, 0.012, 0.05);
  const pins = new THREE.InstancedMesh(pinG, mat.silver, 4 * 26);
  const m4 = new THREE.Matrix4(); let n = 0;
  for (let i = 0; i < 26; i++) {
    const tx = -0.43 + i * (0.86 / 25), tz = -0.32 + i * (0.64 / 25);
    m4.makeTranslation(tx, 0.01, -0.39); pins.setMatrixAt(n++, m4);
    m4.makeTranslation(tx, 0.01, 0.39); pins.setMatrixAt(n++, m4);
    m4.makeRotationY(Math.PI / 2).setPosition(-0.5, 0.01, tz); pins.setMatrixAt(n++, m4);
    m4.makeRotationY(Math.PI / 2).setPosition(0.5, 0.01, tz); pins.setMatrixAt(n++, m4);
  }
  set.add(pins);
  // componentes pequenos espalhados
  const r = rng(33);
  const comps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x05070b, metalness: 0.5, roughness: 0.35, envMapIntensity: 0.4 }), 60);
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, d = 0.9 + r() * 2.6;
    const w = 0.06 + r() * 0.22, dd = 0.05 + r() * 0.16, h = 0.02 + r() * 0.06;
    pv.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() > 0.5 ? 0 : Math.PI / 2);
    sc.set(w, h, dd); m4.compose(pv, q, sc); comps.setMatrixAt(i, m4);
  }
  set.add(comps);
  // faíscas
  const COUNT = 320, pPos = new Float32Array(COUNT * 3), pPh = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = r() * Math.PI * 2, d = 0.55 + Math.pow(r(), 0.7) * 3.4;
    pPos[i * 3] = Math.cos(a) * d; pPos[i * 3 + 1] = 0.01 + r() * 0.06; pPos[i * 3 + 2] = Math.sin(a) * d; pPh[i] = r() * 50;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('aPh', new THREE.BufferAttribute(pPh, 1));
  const sparks = new THREE.Points(pg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: uni.uTime, uScale: { value: 1 } },
    vertexShader: `attribute float aPh; uniform float uTime; uniform float uScale; varying float vA;
      void main(){ vA = pow(max(0.0, sin(uTime * (0.6 + fract(aPh) * 0.9) + aPh)), 10.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (0.014 + 0.04 * vA) * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
      float g = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(0.75, 0.86, 1.0) * g * vA, 1.0); }`
  }));
  set.add(sparks);
  // cúpula de vidro e borda da caixa, vistas de dentro do relógio
  const domeR = 6.2, open = 0.44;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(domeR, 96, 32, 0, Math.PI * 2, 0, open), new THREE.MeshPhysicalMaterial({
    color: 0xcfdcff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.035, clearcoat: 1, envMapIntensity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
  dome.position.y = 1.15 - domeR; set.add(dome);
  const rimR = domeR * Math.sin(open);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.16, 24, 200), mat.tiPolish);
  rim.rotation.x = Math.PI / 2; rim.position.y = dome.position.y + domeR * Math.cos(open); set.add(rim);
  const light = new THREE.PointLight(0x6b9bff, 3, 4, 2); light.position.set(0, 0.5, 0); set.add(light);
  return { set, uni, light, sparks };
}

/* ---------- principal ---------- */
export function createWatch(canvas, { faceCanvas, tier = 'high', backText = 'VOLT ONE  ·  TITÂNIO  ·  SAFIRA  ·  CONCEITO DE PORTFÓLIO  ·  ', transparent = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: transparent, preserveDrawingBuffer: transparent, powerPreference: 'high-performance' });
  renderer.setClearColor(0x04060c, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const envTex = studioEnvironment(renderer);
  scene.environment = envTex;
  scene.environmentIntensity = 1.1;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 160);

  // fundo sólido #070D18 dentro do WebGL, para o vidro com transmissão enxergar a mesma cor
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthWrite: false, depthTest: false,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    uniforms: { uBg: { value: new THREE.Vector3(...BG) } },
    fragmentShader: `uniform vec3 uBg; void main(){ gl_FragColor = vec4(uBg, 1.0); }`
  }));
  bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);

  const brushCase = brushedTexture(11); brushCase.repeat.set(5, 1);
  const brushLug = brushedTexture(12); brushLug.repeat.set(1.6, 1.6);
  const strapA = strapTextures(false), strapB = strapTextures(true);
  const mat = {
    ti: new THREE.MeshPhysicalMaterial({ color: 0x6b727d, metalness: 1, roughness: 1, roughnessMap: brushCase, bumpMap: brushCase, bumpScale: 0.35, anisotropy: 0.85, clearcoat: 0.08 }),
    tiLug: new THREE.MeshPhysicalMaterial({ color: 0x6b727d, metalness: 1, roughness: 1, roughnessMap: brushLug, bumpMap: brushLug, bumpScale: 0.3, anisotropy: 0.7 }),
    tiPolish: new THREE.MeshPhysicalMaterial({ color: 0x7a828f, metalness: 1, roughness: 0.09 }),
    tiBezel: new THREE.MeshPhysicalMaterial({ color: 0x6d7582, metalness: 1, roughness: 0.14, bumpMap: bezelBump(), bumpScale: 0.6 }),
    tiDark: new THREE.MeshPhysicalMaterial({ color: 0x3a4049, metalness: 1, roughness: 0.38 }),
    black: new THREE.MeshStandardMaterial({ color: 0x04060a, metalness: 0.3, roughness: 0.32 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x10141c, metalness: 0.45, roughness: 0.3 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 1, roughness: 0.22 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc8a25b, metalness: 1, roughness: 0.26 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xb8772a, metalness: 0.2, roughness: 0.42 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xa8916c, metalness: 0.1, roughness: 0.5 }),
    battery: new THREE.MeshPhysicalMaterial({ color: 0x8d96a4, metalness: 0.85, roughness: 0.3, clearcoat: 0.4 }),
    back: new THREE.MeshPhysicalMaterial({ color: 0x141920, metalness: 0.1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 }),
    window: new THREE.MeshPhysicalMaterial({ color: 0x030408, metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02 }),
    led: new THREE.MeshBasicMaterial({ color: 0x45ffa8, toneMapped: false }),
    ledBlue: new THREE.MeshBasicMaterial({ color: 0x7aa6ff, toneMapped: false }),
    diode: new THREE.MeshStandardMaterial({ color: 0x1b1630, metalness: 0.4, roughness: 0.2 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x2864f0, emissive: 0x1e56e6, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.25 }),
    strapA: new THREE.MeshPhysicalMaterial({ color: 0x141a26, roughness: 0.78, map: strapA.map, bumpMap: strapA.bump, bumpScale: 1.2, sheen: 0.35, sheenColor: 0x3a4a70, sheenRoughness: 0.55, transparent: true, side: THREE.DoubleSide }),
    strapB: new THREE.MeshPhysicalMaterial({ color: 0x141a26, roughness: 0.78, map: strapB.map, bumpMap: strapB.bump, bumpScale: 1.2, sheen: 0.35, sheenColor: 0x3a4a70, sheenRoughness: 0.55, transparent: true, side: THREE.DoubleSide }),
    line: new THREE.MeshBasicMaterial({ color: 0x2a3550, toneMapped: false })
  };
  // vidro que só soma reflexos: a tela atrás dele é desenhada direto, sem nova passada em baixa resolução
  mat.glass = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0.03, ior: 1.77, specularIntensity: 1,
    clearcoat: 1, clearcoatRoughness: 0.03, envMap: envTex, envMapIntensity: 1.1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  mat.glassTint = new THREE.MeshBasicMaterial({ color: 0x9db6ff, transparent: true, opacity: 0.05, depthWrite: false, toneMapped: false });
  mat.glassEdge = new THREE.MeshPhysicalMaterial({ color: 0xc7d6ff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.5, envMapIntensity: 2 });

  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false });

  const root = new THREE.Group(); scene.add(root);
  const watch = new THREE.Group(); watch.rotation.order = 'YXZ'; root.add(watch);
  const parts = {};
  const mk = (name) => { const g = new THREE.Group(); g.name = name; watch.add(g); parts[name] = g; return g; };

  /* 01 vidro de safira */
  const glass = mk('glass');
  const glassGeo = lathe([[0, 0.21], [0.865, 0.21], [0.868, 0.243], [0.85, 0.259], [0.8, 0.262], [0, 0.262]], 160, 0.008);
  const tint = new THREE.Mesh(glassGeo, mat.glassTint); tint.renderOrder = 2; glass.add(tint);
  const gl2 = new THREE.Mesh(glassGeo, mat.glass); gl2.renderOrder = 3; glass.add(gl2);
  const glassEdge = new THREE.Mesh(new THREE.TorusGeometry(0.862, 0.005, 8, 200), mat.glassEdge); glassEdge.position.z = 0.25; glass.add(glassEdge);

  /* 02 moldura de titânio polido com índices gravados */
  const bezel = mk('bezel');
  bezel.add(new THREE.Mesh(lathe([[0.855, 0.19], [0.855, 0.155], [0.985, 0.155], [1.0, 0.175], [0.997, 0.205], [0.955, 0.232], [0.878, 0.237], [0.855, 0.222], [0.855, 0.19]], 240, 0.012), mat.tiBezel));

  /* 03 módulo de tela */
  const display = mk('display');
  display.add(new THREE.Mesh(lathe([[0, 0.13], [0.845, 0.13], [0.848, 0.178], [0.84, 0.182], [0, 0.182]], 160, 0.006), mat.black));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.8, 160), faceMat); face.position.z = 0.1832; display.add(face);
  const flexD = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.008), mat.amber); flexD.position.set(-0.3, -0.62, 0.125); display.add(flexD);

  /* 04 placa principal */
  const pcb = mk('pcb');
  {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 0.79, -55 * D2R, 235 * D2R, false); sh.closePath();
    for (const [hx, hy] of [[-0.55, 0.32], [0.55, 0.32]]) { const h = new THREE.Path(); h.absarc(hx, hy, 0.03, 0, Math.PI * 2, true); sh.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.028, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 72 });
    const tex = pcbTexture(); tex.repeat.set(1 / 1.6, 1 / 1.6); tex.offset.set(0.5, 0.5);
    const top = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.25, roughness: 0.45 });
    const board = new THREE.Mesh(g, [top, mat.gold]); board.position.z = 0.02; pcb.add(board);
    const zt = 0.051;
    const box = (w, h, d, x, y, m, rad = 0.01) => { const b = new THREE.Mesh(new THREE.RoundedBoxGeometry(w, h, d, 2, rad), m); b.position.set(x, y, zt + d / 2); pcb.add(b); return b; };
    box(0.32, 0.32, 0.045, -0.08, 0.12, mat.chip);
    const lid = box(0.25, 0.25, 0.008, -0.08, 0.12, mat.silver, 0.003); lid.position.z = zt + 0.049;
    box(0.16, 0.16, 0.035, 0.32, 0.22, mat.chip);
    box(0.24, 0.13, 0.035, -0.12, -0.22, mat.chip);
    box(0.34, 0.2, 0.03, 0.26, -0.24, mat.silver, 0.006);
    box(0.1, 0.1, 0.03, -0.47, 0.06, mat.chip);
    box(0.12, 0.08, 0.025, 0.05, 0.47, mat.chip);
    const coax = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 24), mat.gold); coax.rotation.x = Math.PI / 2; coax.position.set(0.55, 0.0, zt + 0.015); pcb.add(coax);
    const flex = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.006), mat.amber); flex.position.set(-0.46, -0.36, zt + 0.003); pcb.add(flex);
    const r = rng(11);
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.044, 0.022, 0.022), mat.ceramic, 46);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
    const clusters = [[-0.08, 0.36], [0.3, 0.02], [-0.38, -0.1], [0.06, -0.44], [-0.3, 0.42]];
    for (let i = 0; i < 46; i++) {
      const c = clusters[i % clusters.length];
      pv.set(c[0] + (r() - 0.5) * 0.22, c[1] + (r() - 0.5) * 0.12, zt + 0.011);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() > 0.5 ? 0 : Math.PI / 2);
      m4.compose(pv, q, sc); caps.setMatrixAt(i, m4);
    }
    pcb.add(caps);
  }

  /* 06 bateria */
  const battery = mk('battery');
  battery.add(new THREE.Mesh(new THREE.RoundedBoxGeometry(1.04, 0.94, 0.12, 4, 0.045), mat.battery)).position.z = -0.085;
  {
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a2232, metalness: 0.3, roughness: 0.5 }));
    label.position.set(0, -0.06, -0.0245); battery.add(label);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.035), mat.accent); stripe.position.set(0, 0.17, -0.024); battery.add(stripe);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.02), mat.gold); tab.position.set(0.2, 0.49, -0.04); battery.add(tab);
  }

  /* 05 tampa traseira com sensores, halos e feixes de luz */
  const back = mk('back');
  const beamMats = [];
  const halos = [];
  back.add(new THREE.Mesh(lathe([[0, -0.293], [0.73, -0.293], [0.82, -0.262], [0.875, -0.215], [0.9, -0.185], [0.9, -0.171], [0, -0.171]], 200, 0.014), mat.back));
  back.add(new THREE.Mesh(lathe([[0, -0.312], [0.33, -0.309], [0.4, -0.301], [0.415, -0.294], [0, -0.294]], 160, 0.006), mat.window));
  {
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x5a6578, metalness: 0.7, roughness: 0.3, alphaMap: backTextTexture(backText), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.72, 160), ringMat);
    const uv = ring.geometry.attributes.uv, p = ring.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / 0.72 * (470 / 1024), 0.5 + p.getY(i) / 0.72 * (470 / 1024));
    ring.rotation.x = Math.PI; ring.position.z = -0.2938; back.add(ring); parts.backRing = ring;
    const down = (m) => { m.rotation.x = Math.PI; return m; };
    const lens = down(new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.window));
    lens.scale.set(1, 1, 0.35); lens.position.z = -0.312; back.add(lens);
    const glowTex = glowTexture();
    for (let k = 0; k < 4; k++) {
      const a = (45 + k * 90) * D2R, blue = k === 1;
      const lx = Math.cos(a) * 0.17, ly = Math.sin(a) * 0.17;
      const led = down(new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), blue ? mat.ledBlue : mat.led));
      led.position.set(lx, ly, -0.3125); back.add(led);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: blue ? 0x6b9bff : 0x45ffa8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5, toneMapped: false }));
      halo.scale.set(0.16, 0.16, 1); halo.position.set(lx, ly, -0.322); back.add(halo); halos.push(halo);
      // feixe de luz saindo do sensor, como em uma foto de produto
      const H = 1.1;
      const bg2 = new THREE.CylinderGeometry(0.03, 0.12, H, 32, 1, true);
      bg2.translate(0, -H / 2, 0); bg2.rotateX(Math.PI / 2); // o cone abre para -Z, para fora da traseira
      const bm = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uC: { value: new THREE.Color(blue ? 0x6b9bff : 0x45ffa8) }, uO: { value: 0 }, uH: { value: H } },
        vertexShader: `varying float vZ; varying vec3 vN; varying vec3 vV;
          void main(){ vZ = position.z; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uC; uniform float uO; uniform float uH; varying float vZ; varying vec3 vN; varying vec3 vV;
          void main(){ float along = clamp(1.0 + vZ / uH, 0.0, 1.0); float edge = pow(abs(dot(vN, vV)), 1.6);
            float a = pow(along, 2.2) * edge * uO; gl_FragColor = vec4(uC * a * 0.9, 1.0); }`
      });
      beamMats.push(bm);
      const beam = new THREE.Mesh(bg2, bm); beam.position.set(lx, ly, -0.315); back.add(beam);
      const b = k * 90 * D2R;
      const d = down(new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.05), mat.diode));
      d.position.set(Math.cos(b) * 0.27, Math.sin(b) * 0.27, -0.3108); d.rotation.z = b; back.add(d);
    }
    for (const rr of [0.215, 0.35]) {
      const l = down(new THREE.Mesh(new THREE.RingGeometry(rr, rr + 0.004, 96), mat.line));
      l.position.z = rr < 0.3 ? -0.3122 : -0.3095; back.add(l);
    }
    const coilTex = canvasTex(512, 512, (x, W) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, W, W); x.translate(W / 2, W / 2);
      for (let k = 0; k < 26; k++) { x.strokeStyle = k % 2 ? '#7a4a22' : '#c98a4b'; x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 70 + k * 6.6, 0, Math.PI * 2); x.stroke(); }
    });
    const coil = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.62, 128), new THREE.MeshStandardMaterial({ map: coilTex, metalness: 0.85, roughness: 0.32 }));
    { const uv = coil.geometry.attributes.uv, p = coil.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / 0.62 * (241 / 512), 0.5 + p.getY(i) / 0.62 * (241 / 512)); }
    coil.position.z = -0.1695; back.add(coil);
    const coilHub = new THREE.Mesh(new THREE.CircleGeometry(0.2, 64), mat.chip); coilHub.position.z = -0.1694; back.add(coilHub);
  }

  /* caixa: flanco escovado, chanfro polido, alças suaves, coroa serrilhada e botão */
  const kase = mk('case');
  kase.add(new THREE.Mesh(lathe([[0.89, 0.166], [0.89, -0.175]], 200, 0), mat.tiDark));                                   // parede interna
  kase.add(new THREE.Mesh(lathe([[0.89, -0.175], [0.93, -0.182], [0.985, -0.13]], 200, 0.02), mat.ti));                // base
  kase.add(new THREE.Mesh(lathe([[0.985, -0.13], [1.0, -0.06], [1.0, 0.08]], 200, 0.03), mat.ti));                     // flanco escovado
  kase.add(new THREE.Mesh(lathe([[1.0, 0.08], [0.99, 0.14], [0.955, 0.166], [0.89, 0.166]], 200, 0.022), mat.tiPolish)); // chanfro polido
  {
    const sh = new THREE.Shape();
    sh.moveTo(0.72, 0.125);
    sh.bezierCurveTo(0.95, 0.12, 1.12, 0.08, 1.2, 0.0);
    sh.bezierCurveTo(1.25, -0.05, 1.22, -0.12, 1.14, -0.145);
    sh.bezierCurveTo(1.0, -0.17, 0.86, -0.17, 0.76, -0.165);
    sh.closePath();
    const lg = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.028, bevelSegments: 6, curveSegments: 24 });
    lg.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
    for (const sx of [0.31, -0.43]) for (const flip of [0, 1]) {
      const m = new THREE.Mesh(lg, mat.tiLug); m.position.x = sx;
      const holder = new THREE.Group(); holder.add(m);
      if (flip) holder.rotation.z = Math.PI;
      kase.add(holder);
    }
    // coroa com serrilhado fino
    const crown = new THREE.Group(); crown.name = 'crown';
    const cg = new THREE.LatheGeometry(roundPoly([[0, 0.97], [0.07, 0.97], [0.07, 1.02], [0.125, 1.02], [0.136, 1.034], [0.136, 1.138], [0.125, 1.152], [0.0, 1.154]], 0.008), 360);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i), z = p.getZ(i), rr = Math.hypot(x, z);
      if (y > 1.042 && y < 1.128 && rr > 0.13) {
        const a = Math.atan2(z, x); const ridge = Math.abs(Math.sin(a * 36));
        const k = 1 + 0.035 * Math.pow(ridge, 0.6) - 0.022;
        p.setX(i, x * k); p.setZ(i, z * k);
      }
    }
    cg.computeVertexNormals(); cg.rotateZ(-Math.PI / 2);
    crown.add(new THREE.Mesh(cg, mat.tiPolish));
    const ringC = new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.011, 16, 128), mat.accent);
    ringC.rotation.y = Math.PI / 2; ringC.position.x = 1.152; crown.add(ringC);
    const capC = new THREE.Mesh(new THREE.CircleGeometry(0.092, 96), new THREE.MeshPhysicalMaterial({ color: 0x4a515c, metalness: 1, roughness: 0.18 }));
    capC.rotation.y = Math.PI / 2; capC.position.x = 1.1545; crown.add(capC);
    crown.position.y = 0.12;
    kase.add(crown); parts.crown = crown;
    const a = -24 * D2R;
    const pusher = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.08, 0.26, 0.1, 4, 0.038), mat.tiPolish);
    pusher.position.set(Math.cos(a) * 1.0, Math.sin(a) * 1.0, -0.01); pusher.rotation.z = a; kase.add(pusher);
    for (const sy of [1.07, -1.07]) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 12), mat.silver);
      pin.rotation.z = Math.PI / 2; pin.position.set(0, sy, -0.05); kase.add(pin);
    }
  }

  /* pulseiras de borracha com fivela de titânio */
  const topPts = [[0.96, -0.04], [1.24, -0.08], [1.48, -0.22], [1.66, -0.5], [1.75, -0.88], [1.72, -1.28], [1.56, -1.66], [1.27, -1.96], [0.88, -2.15], [0.44, -2.25], [0.02, -2.27], [-0.14, -2.27]];
  const botPts = [[-0.96, -0.04], [-1.24, -0.08], [-1.48, -0.22], [-1.66, -0.5], [-1.75, -0.88], [-1.72, -1.28], [-1.56, -1.66], [-1.27, -1.97], [-0.88, -2.17], [-0.44, -2.29], [0.0, -2.37], [0.34, -2.39], [0.6, -2.38]];
  const sTop = strapGeometry(topPts, 0.56, 0.11), sBot = strapGeometry(botPts, 0.56, 0.11);
  const strapTop = new THREE.Group(); strapTop.name = 'strapTop'; watch.add(strapTop);
  const strapBot = new THREE.Group(); strapBot.name = 'strapBottom'; watch.add(strapBot);
  strapTop.add(new THREE.Mesh(sTop.geo, mat.strapA));
  strapBot.add(new THREE.Mesh(sBot.geo, mat.strapB));

  /* cena do chip para as Especificações */
  const chipSet = buildChipSet(mat);
  chipSet.set.position.set(0, -60, 0); chipSet.set.visible = false; scene.add(chipSet.set);

  /* luzes */
  scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x05070d, 0.25));
  const key = new THREE.DirectionalLight(0xe8eeff, 2.0); scene.add(key); scene.add(key.target);
  const rimL = new THREE.DirectionalLight(0x3b78ff, 2.6); rimL.position.set(-5, 1.3, -2.4); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0x6b9bff, 0.6); rimR.position.set(5, -1.2, -3); scene.add(rimR);
  const under = new THREE.DirectionalLight(0x8fa8d8, 0.7); under.position.set(1, -6, 3); scene.add(under);
  const battLight = new THREE.PointLight(0x4f86ff, 0, 2.6, 2); battery.add(battLight); battLight.position.set(0, 0, 0.4);

  /* acabamentos: a cor muda, a construção continua idêntica */
  const FINISHES = [
    { ti: 0x6b727d, polish: 0x7a828f, bezel: 0x6d7582, strap: 0x141a26 },
    { ti: 0xa7abb2, polish: 0xc4c8ce, bezel: 0xb2b6bc, strap: 0x2c3038 },
    { ti: 0x33426a, polish: 0x4a5c92, bezel: 0x3e4f80, strap: 0x0f1a33 }
  ];
  const finishTargets = { ti: new THREE.Color(), polish: new THREE.Color(), bezel: new THREE.Color(), strap: new THREE.Color() };
  let finishMoving = false;
  function setFinishTargets(i) {
    const f = FINISHES[i] || FINISHES[0];
    finishTargets.ti.set(f.ti); finishTargets.polish.set(f.polish); finishTargets.bezel.set(f.bezel); finishTargets.strap.set(f.strap);
    finishMoving = true;
  }
  setFinishTargets(0);
  function stepFinish() {
    if (!finishMoving) return;
    const pairs = [[mat.ti, 'ti'], [mat.tiLug, 'ti'], [mat.tiPolish, 'polish'], [mat.tiBezel, 'bezel'], [mat.strapA, 'strap'], [mat.strapB, 'strap']];
    let d = 0;
    for (const [m, k] of pairs) { m.color.lerp(finishTargets[k], 0.09); d += Math.abs(m.color.r - finishTargets[k].r) + Math.abs(m.color.g - finishTargets[k].g) + Math.abs(m.color.b - finishTargets[k].b); }
    if (d < 0.003) { for (const [m, k] of pairs) m.color.copy(finishTargets[k]); finishMoving = false; }
  }

  /* aplicação do estado */
  const tmpV = new THREE.Vector3(), target = new THREE.Vector3(), camOff = new THREE.Vector3();
  let W = 1, H = 1;
  const anchorV = ANCHORS.map(a => new THREE.Vector3(...a));
  const out = { anchors: PART_NAMES.map(() => ({ x: 0, y: 0, z: 0 })), center: { x: 0, y: 0 } };
  let crownAngle = 0;

  function apply(S, t, par, fx) {
    const chipMode = S.set > 0.5;
    fx = fx || NOFX;
    stepFinish();
    watch.visible = !chipMode; chipSet.set.visible = chipMode;
    const osc = S.spin;
    if (!chipMode) {
      watch.rotation.x = (S.rx + fx.rx) * D2R + osc * 0.035 * Math.sin(t / 9000 * Math.PI * 2) + par.y * 0.08;
      watch.rotation.y = (S.ry + fx.ry) * D2R + osc * 0.3 * Math.sin(t / 13000 * Math.PI * 2) + par.x * 0.12;
      watch.rotation.z = (S.rz || 0) * D2R;
      root.position.y = osc * 0.035 * Math.sin(t / 7000 * Math.PI * 2);
      PART_NAMES.forEach((n, i) => { parts[n].position.z = OFFSETS[i] * S['e' + i]; });
      const s = S.strap;
      strapTop.position.set(0, s * 0.9, -s * 0.35); strapBot.position.set(0, -s * 0.9, -s * 0.35);
      strapTop.visible = strapBot.visible = s < 0.995;
      mat.strapA.opacity = mat.strapB.opacity = 1 - s;
      mat.strapA.depthWrite = mat.strapB.depthWrite = s < 0.5;
      parts.crown.rotation.x = crownAngle;
      const b = clamp01(S.beam || 0);
      beamMats.forEach(m => { m.uniforms.uO.value = b; });
      halos.forEach(h => { h.material.opacity = 0.35 + 0.65 * b; });
    } else {
      chipSet.set.rotation.y = 0;
      chipSet.uni.uTime.value = t / 1000;
      chipSet.light.intensity = 2.4 + 0.8 * Math.sin(t / 1000 * 1.4);
      chipSet.sparks.material.uniforms.uScale.value = H * renderer.getPixelRatio() * 1.87;
    }
    rimL.intensity = 2.6 * S.rim; rimR.intensity = 0.6 * S.rim;
    mat.accent.emissiveIntensity = 0.5 + 0.5 * S.rim;
    const ka = S.key * D2R;
    key.position.set(Math.sin(ka) * 8, 5.5, Math.cos(ka) * 8);
    battLight.intensity = S.bglow * 5;
    faceMat.color.setScalar(S.screen);
    // fundo do palco: mistura para o cinza da seção de detalhes
    { const k = clamp01(S.bgMix || 0); bg.material.uniforms.uBg.value.set(BG[0] + (BG2[0] - BG[0]) * k, BG[1] + (BG2[1] - BG[1]) * k, BG[2] + (BG2[2] - BG[2]) * k); }
    mat.glass.envMapIntensity = 1.1 * (S.glassI ?? 1);

    const host = chipMode ? chipSet.set : watch;
    host.updateMatrixWorld(true);
    target.set(S.tx + (chipMode ? 0 : fx.tx), S.ty + (chipMode ? 0 : fx.ty), S.tz + (chipMode ? 0 : fx.tz));
    if (chipMode) target.add(chipSet.set.position); else watch.localToWorld(target);
    const aspect = W / H;
    const dist = S.dist * (chipMode ? 1 : fx.zoom) * Math.max(1, S.fitA / aspect);
    const el = S.el * D2R, az = S.az * D2R;
    camOff.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(dist);
    camera.position.copy(target).add(camOff);
    camera.lookAt(target);
    camera.setViewOffset(W, H, -S.shiftX * W, S.shiftY * H, W, H);
    camera.updateMatrixWorld();

    if (!chipMode) {
      tmpV.set(0, 0, 0); watch.localToWorld(tmpV); tmpV.project(camera);
      out.center.x = (tmpV.x * 0.5 + 0.5) * W; out.center.y = (-tmpV.y * 0.5 + 0.5) * H;
      PART_NAMES.forEach((n, i) => {
        tmpV.copy(anchorV[i]); parts[n].localToWorld(tmpV); tmpV.project(camera);
        const a = out.anchors[i];
        a.x = (tmpV.x * 0.5 + 0.5) * W; a.y = (-tmpV.y * 0.5 + 0.5) * H; a.z = tmpV.z;
      });
    }
  }
  const NOFX = { rx: 0, ry: 0, zoom: 1, tx: 0, ty: 0, tz: 0 };
  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

  return {
    renderer, parts, out,
    resize(w, h, dpr) { W = w; H = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    render(S, t, par, fx) { apply(S, t, par, fx); renderer.render(scene, camera); },
    setFinish(i) { setFinishTargets(i); },
    isAnimating() { return finishMoving; },
    setCrown(a) { crownAngle = a; },
    refreshFace() { faceTex.needsUpdate = true; },
    setBackText(text) {
      const old = parts.backRing.material.alphaMap; parts.backRing.material.alphaMap = backTextTexture(text); parts.backRing.material.needsUpdate = true; if (old) old.dispose();
    },
    lowerQuality() { /* o vidro já não usa passada extra; nada a reduzir além da resolução */ },
    dispose() {
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); });
          if (m.uniforms) Object.values(m.uniforms).forEach(u => { if (u.value && u.value.isTexture) u.value.dispose(); });
          m.dispose();
        });
      });
      envTex.dispose(); faceTex.dispose();
      renderer.dispose();
      try { if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); } catch (e) { /* já perdido */ }
    }
  };
}
