/* VOLT One · coreografia da página
   Um canvas fixo renderiza o relógio 3D. Uma timeline GSAP (ScrollTrigger com scrub) interpola
   o objeto de estado S entre poses ancoradas nas seções. O loop de render só roda quando algo muda
   e dorme quando nada se move. Sem WebGL, a página mostra uma imagem estática, sem nenhum botão de troca. */

import { drawFace } from './face.js?v=32';
import { EN, RUNTIME } from './i18n.js?v=32';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const qs = new URLSearchParams(location.search);
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const MOBILE_Q = '(max-width: 720px), (orientation: portrait) and (max-width: 1024px)';
const mqMobile = matchMedia(MOBILE_Q);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
};
$('#year').textContent = new Date().getFullYear();

/* ---------------- WebGL disponível? ---------------- */
function webglStatus() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'none';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return /swiftshader|llvmpipe|softpipe|software/i.test(r) ? 'soft' : 'ok';
  } catch (e) { return 'none'; }
}
const tier = qs.get('tier') || ((matchMedia('(pointer: coarse)').matches || mqMobile.matches) ? 'mid' : 'high');
const stillDebug = qs.has('still'); // depuração: sem giro contínuo
let no3d = qs.has('no3d') || (!qs.has('force3d') && webglStatus() !== 'ok');

/* ---------------- elementos ---------------- */
const nav = $('#nav');
const sec = {
  intro: $('#engenharia'), mat: $('#materiais'),
  rebuild: $('#reconstrucao'), det: $('#detalhes'), exp: $('#experiencia'), feats: $('#recursos'), specs: $('#especificacoes'), family: $('#modelos'), close: $('#encerramento')
};
const steps = $$('.step'), gaugeItems = $$('#gauge li'), mats = $$('.mat');
const callout = $('#callout');
const overlay = $('#overlay');

/* ---------------- idioma ---------------- */
// o português está escrito no HTML; guardamos o original para poder voltar a ele
const PT = {}, PT_ARIA = {};
$$('[data-i18n]').forEach(el => { PT[el.dataset.i18n] = el.innerHTML.trim(); });
$$('[data-i18n-aria]').forEach(el => { PT_ARIA[el.dataset.i18nAria] = el.getAttribute('aria-label'); });
$$('[data-i18n-alt]').forEach(el => { PT[el.dataset.i18nAlt] = el.getAttribute('alt'); });
PT_ARIA.featsPlay = 'Reproduzir';
window.__voltT = k => (lang === 'en' ? EN[k] : PT_ARIA[k]) || PT_ARIA[k];
let lang = (qs.get('lang') || store.get('volt-lang') || 'pt') === 'en' ? 'en' : 'pt';
const R = () => RUNTIME[lang];
const tx = k => (lang === 'en' ? EN[k] : PT[k]) ?? PT[k] ?? '';
function splitWords() {
  $$('[data-split]').forEach(el => { el.innerHTML = tx(el.dataset.split).replace(/<[^>]+>/g, '').trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' '); });
}
let langRebuild = 0;
function applyLang(l, initial = false) {
  lang = l;
  if (!initial) store.set('volt-lang', l);
  root.lang = R().htmlLang;
  $$('[data-i18n]').forEach(el => { const v = tx(el.dataset.i18n); if (el.innerHTML !== v) el.innerHTML = v; });
  $$('[data-i18n-aria]').forEach(el => { const k = el.dataset.i18nAria; el.setAttribute('aria-label', lang === 'en' ? (EN[k] || PT_ARIA[k]) : PT_ARIA[k]); });
  $$('[data-i18n-alt]').forEach(el => el.setAttribute('alt', tx(el.dataset.i18nAlt)));
  const md = $('meta[name="description"]'); if (md) md.setAttribute('content', R().description);
  $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  dial.setAttribute('aria-valuetext', R().modes[crownMode]);
  splitWords();
  if (three) { buildTags(); three.setBackText(R().back); }
  paintFaces();
  if (window.__expShots) window.__expShots();
  if (!initial && three) {
    clearTimeout(langRebuild);
    langRebuild = setTimeout(() => { buildTextScrubs(); buildMaster(); }, 60);
  }
}

/* ---------------- layout (posições das seções) ---------------- */
let L = null;
function measure() {
  const vh = innerHeight;
  const box = el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, h: el.offsetHeight }; };
  const o = { vh };
  for (const k in sec) { o[k] = box(sec[k]); o[k].r = Math.max(1, o[k].h - vh); }
  o.matLen = o.mat.r / 4;
  o.max = Math.max(1, document.documentElement.scrollHeight - vh);
  L = o;
}

/* ---------------- rolagem suave nos cliques: as peças se movem aos poucos ---------------- */
let glideTw = null;
function stopGlide() { if (glideTw) { glideTw.kill(); glideTw = null; } }
function glideTo(y) {
  if (!L) measure();
  y = clamp(y, 0, L.max);
  const d = Math.abs(y - scrollY);
  if (mqReduce.matches || !window.gsap || d < 4) { scrollTo(0, y); return; }
  stopGlide();
  const o = { y: scrollY };
  // a duração cresce com a distância: um salto longo vira um deslize calmo, nunca um pulo
  glideTw = gsap.to(o, { y, duration: clamp(1.1 + d / 2400, 1.1, 3.6), ease: 'power2.inOut', onUpdate: () => scrollTo(0, o.y), onComplete: () => { glideTw = null; } });
}
['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, e => { if (ev !== 'keydown' || /Arrow|Page|Home|End|Space/.test(e.code)) stopGlide(); }, { passive: true }));
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  e.preventDefault();
  measure();
  glideTo(el.getBoundingClientRect().top + scrollY);
  if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
});
$$('#gauge button').forEach(b => b.addEventListener('click', () => {
  measure();
  const i = +b.dataset.go;
  glideTo(L.mat.top);
}));

/* ---------------- roda de camadas: a ativa no centro, vizinhas esmaecidas ---------------- */
function setWheel(i) {
  const c = Math.max(i, 0);
  gaugeItems.forEach((g, k) => {
    const d = k - c, a = Math.abs(d);
    g.style.setProperty('--d', d);
    g.style.setProperty('--s', a === 0 ? 1 : 0.8);
    g.style.setProperty('--o', a === 0 ? 1 : a === 1 ? 0.42 : 0);
    g.classList.toggle('is-active', d === 0);
    g.classList.toggle('is-off', a > 1);
    g.querySelector('button').tabIndex = a > 1 ? -1 : 0;
  });
}
setWheel(0);

/* ---------------- estado ativo das etapas ---------------- */
let activeStep = -2, activeMat = -2;
function setStep(i) {
  if (i === activeStep) return;
  activeStep = i;
  steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
  setWheel(i);
  callout.classList.remove('on');
  if (i >= 0) requestAnimationFrame(() => requestAnimationFrame(() => callout.classList.add('on')));
}
function setMat(i) {
  if (i === activeMat) return;
  activeMat = i;
  mats.forEach((m, k) => m.classList.toggle('is-active', k === i));
  sec.mat.classList.toggle('head-off', i > 0);
}
function onScrollUI() {
  const y = scrollY;
  nav.classList.toggle('scrolled', y > 30);
  if (!L) measure();
  const m = L.mat;
  if (y >= m.top - L.vh * 0.6 && y <= m.top + m.h) setMat(clamp(Math.floor((y - m.top + L.matLen * 0.1) / L.matLen), 0, 3));
  else setMat(-1);
}
let scrollQueued = false;
addEventListener('scroll', () => {
  if (scrollQueued) return; scrollQueued = true;
  requestAnimationFrame(() => { scrollQueued = false; onScrollUI(); });
}, { passive: true });

/* ---------------- entradas por interseção ---------------- */
const io = new IntersectionObserver(es => es.forEach(en => {
  if (en.isIntersecting) {
    en.target.classList.add('in');
    setTimeout(() => en.target.classList.add('done'), 1500);
    io.unobserve(en.target);
  }
}), { threshold: 0.04 });
$$('.specs .reveal, .family .reveal').forEach(el => io.observe(el));

/* ---------------- mostradores ---------------- */
const MODE_KEYS = ['dia', 'treino', 'foco', 'noite'];
let crownMode = 0, faceMode = 'hora', faceCanvas = null;
function paintFaces() {
  if (faceCanvas) { drawFace(faceCanvas, faceMode, new Date(), lang); if (three) three.refreshFace(); invalidate(); }
}
let expVisible = false;
new IntersectionObserver(es => es.forEach(en => {
  expVisible = en.isIntersecting;
  const want = expVisible ? MODE_KEYS[crownMode] : 'hora';
  if (want !== faceMode) { faceMode = want; flashScreen(); }
}), { threshold: 0.35 }).observe(sec.exp);
// a hora real no mostrador: redesenha a cada 30 s
setInterval(() => { if (!document.hidden && faceMode !== 'treino') paintFaces(); }, 30000);

/* ---------------- fotos da experiência: uma por modo, troca pela coroa ---------------- */
const expImgs = $$('.exp__shot img'), expModeName = $('#expModeName');
function expShots(m = crownMode) {
  expImgs.forEach((im, k) => {
    const src = `assets/img/exp/exp2-${MODE_KEYS[k]}-${lang}.webp`;
    if (!im.getAttribute('src') || !im.getAttribute('src').endsWith(src)) im.setAttribute('src', src);
    im.classList.toggle('is-active', k === m);
  });
  if (expModeName) expModeName.textContent = R().modes[m];
  $$('.exp__ticks i').forEach((t, k) => t.classList.toggle('on', k === m));
}
window.__expShots = () => expShots(crownMode);
expShots(0);

/* ---------------- coroa interativa ---------------- */
const dial = $('#dial'), knurl = $('#dialKnurl'), dialSvg = $('#dialSvg');
{
  let s = '';
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, x1 = 50 + Math.cos(a) * 44, y1 = 50 + Math.sin(a) * 44, x2 = 50 + Math.cos(a) * 49, y2 = 50 + Math.sin(a) * 49;
    s += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${i % 12 === 0 ? '#6B9BFF' : 'rgba(255,255,255,.22)'}" stroke-width="${i % 12 === 0 ? 2.2 : 1.2}" stroke-linecap="round"/>`;
  }
  dialSvg.innerHTML = s;
}
let crownDeg = 0, crownTarget = 0, crownAnim = null;
const modeButtons = $$('.modes button'), modeCopy = $$('.mc');
function setCrownMode(m, fromDrag = false) {
  m = ((m % 4) + 4) % 4;
  if (m === crownMode && !fromDrag) return;
  const changed = m !== crownMode;
  crownMode = m;
  modeButtons.forEach((b, k) => b.setAttribute('aria-selected', String(k === m)));
  modeCopy.forEach((c, k) => c.classList.toggle('is-active', k === m));
  dial.setAttribute('aria-valuenow', String(m));
  dial.setAttribute('aria-valuetext', R().modes[m]);
  expShots(m);
  if (changed) {
    dial.classList.add('tick'); setTimeout(() => dial.classList.remove('tick'), 220);
    if (expVisible) { faceMode = MODE_KEYS[m]; flashScreen(); }
  }
}
function renderCrown() {
  knurl.style.transform = `rotate(${crownDeg.toFixed(2)}deg)`;
  if (three) { three.setCrown(-crownDeg * Math.PI / 180 * 0.6); invalidate(); }
}
function spinTo(deg) {
  crownTarget = deg;
  if (crownAnim) crownAnim.kill();
  const o = { v: crownDeg };
  if (window.gsap && !mqReduce.matches) crownAnim = gsap.to(o, { v: deg, duration: 0.6, ease: 'back.out(1.6)', onUpdate: () => { crownDeg = o.v; renderCrown(); } });
  else { crownDeg = deg; renderCrown(); }
}
function stepCrown(dir) { const m = Math.round(crownTarget / 90) + dir; spinTo(m * 90); setCrownMode(m); }
modeButtons.forEach(b => b.addEventListener('click', () => {
  const m = +b.dataset.mode;
  const cur = Math.round(crownTarget / 90), curMod = ((cur % 4) + 4) % 4;
  let d = m - curMod; if (d > 2) d -= 4; if (d < -2) d += 4;
  spinTo((cur + d) * 90); setCrownMode(m);
}));
dial.addEventListener('keydown', e => {
  const k = e.key, cur = Math.round(crownTarget / 90), base = cur - (((cur % 4) + 4) % 4);
  if (k === 'ArrowRight' || k === 'ArrowUp') { e.preventDefault(); stepCrown(1); }
  else if (k === 'ArrowLeft' || k === 'ArrowDown') { e.preventDefault(); stepCrown(-1); }
  else if (k === 'Home') { e.preventDefault(); spinTo(base * 90); setCrownMode(0); }
  else if (k === 'End') { e.preventDefault(); spinTo((base + 3) * 90); setCrownMode(3); }
});
{
  let drag = null;
  const ang = e => { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  dial.addEventListener('pointerdown', e => { dial.setPointerCapture(e.pointerId); if (crownAnim) crownAnim.kill(); drag = { a: ang(e), y: e.clientY }; });
  dial.addEventListener('pointermove', e => {
    if (!drag) return;
    let d = ang(e) - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360;
    drag.a = ang(e);
    const dy = drag.y - e.clientY; drag.y = e.clientY; // arrastar para cima também gira
    crownDeg += d + dy * 0.9; crownTarget = crownDeg;
    renderCrown(); setCrownMode(Math.round(crownDeg / 90), true);
  });
  const end = () => { if (!drag) return; drag = null; const m = Math.round(crownDeg / 90); spinTo(m * 90); setCrownMode(m); };
  dial.addEventListener('pointerup', end); dial.addEventListener('pointercancel', end);
}
$$('.lang button').forEach(b => b.addEventListener('click', () => { if (b.dataset.lang !== lang) applyLang(b.dataset.lang); }));

/* ---------------- poses do relógio ---------------- */
const DEF = { rx: -12, ry: -38, rz: 0, el: 4, az: 0, dist: 7.4, fitA: 1.3, shiftX: 0, shiftY: 0, tx: 0, ty: -0.25, tz: -0.6,
  e0: 0, e1: 0, e2: 0, e3: 0, e4: 0, e5: 0, strap: 0, rim: 1, key: -40, spin: 0, vis: 1, bglow: 0, tags: 0, beam: 0, set: 0, glassI: 1, bgMix: 0 };
const STEP_PART = [0, 1, 2, 3, 5, 4]; // etapa -> peça (sensores ficam na tampa, bateria por último)
const EX = (n, v = 1) => { const o = { e0: 0, e1: 0, e2: 0, e3: 0, e4: 0, e5: 0 }; for (let i = 0; i < n; i++) o['e' + STEP_PART[i]] = v; return o; };
function buildPoses(mob) {
  const M = (d, m) => Object.assign({}, DEF, d, mob ? (m || {}) : {});
  const stepBase = { rx: -54, ry: -22, el: 10, shiftX: 0.03, strap: 0, tags: 1, fitA: 0.95, tx: 0, ty: 0 };
  const stepMob = { shiftX: 0, shiftY: 0.22, fitA: 0.86 };
  const frames = [
    // câmera parada: só as peças se separam, sem a cena balançar a cada etapa
    { tz: 1.0, dist: 10.4, tags: 0 }, { tz: 1.0, dist: 10.4 }, { tz: 1.0, dist: 10.4 }, { tz: 1.0, dist: 10.4 },
    { tz: 1.0, dist: 10.4 }, { tz: 1.0, dist: 10.4 }, { tz: 1.0, dist: 10.4, bglow: 1 }
  ];
  const stepsP = frames.map((f, n) => M({ ...stepBase, ...EX(n), ...f }, stepMob));
  const mBase = { ...EX(6), rx: -54, ry: -22, strap: 1, tags: 0, shiftX: 0.14, fitA: 1.0 };
  const mMob = { shiftX: 0, shiftY: 0.17, fitA: 0.9 };
  const mp = (d) => M({ ...mBase, ...d }, mMob);
  const m1a = { tx: 0.25, ty: 0.2, tz: 3.34, dist: 3.0, el: 22, az: -16, key: -95, glassI: 0.14 };
  const m2a = { tx: -0.96, ty: 0.15, tz: 0, dist: 2.7, el: 6, az: -72, key: -30 };
  const m3a = { tx: 1.08, ty: 0.12, tz: 0, dist: 1.8, el: 10, az: 28, key: 20 };
  const m4a = { tx: 0, ty: 0, tz: -1.29, dist: 3.1, el: -55, az: 10, key: 0, beam: 1 };
  const close = M({ rx: -14, ry: -40, el: -12, dist: 8.6, ty: 0.15, shiftY: -0.33, rim: 1.35, spin: 0 }, { shiftY: -0.2, fitA: 1.15 });
  // experiência espelhada: relógio à esquerda, texto à direita
  const exp = M({ rx: -8, ry: -22, el: -3, dist: 8.0, ty: 0.1, shiftX: -0.22, spin: 0, glassI: 0.45 }, { shiftX: 0, shiftY: 0.22, fitA: 1.25 });
  // detalhes: relógio à direita, quase de frente, para os focos de cada item
  const det = M({ rx: -10, ry: -30, el: 2, dist: 11.5, ty: 0.05, shiftX: 0.2, spin: 0, glassI: 0.18, bgMix: 1 }, { shiftX: 0, shiftY: 0.3, fitA: 1.4 });
  // especificações: close do processador aceso, visto por dentro do vidro
  const chipA = M({ set: 1, tx: 0, ty: 0, tz: 0, el: 52, az: -16, dist: 5.4, fitA: 1.5, spin: 0, rim: 1 }, { fitA: 0.75, dist: 6.2 });
  const chipB = M({ set: 1, tx: 0, ty: 0, tz: 0, el: 46, az: 14, dist: 4.7, fitA: 1.5, spin: 0, rim: 1 }, { fitA: 0.75, dist: 5.6 });
  return {
    hero: M({ rx: -55, ry: 0, rz: -90, el: 4, dist: 6.4, fitA: 1.0, shiftX: 0, shiftY: -0.1, tx: 0, ty: 0, tz: 0, strap: 0, rim: 1.15, glassI: 0.7, key: -40, spin: 0 }, { dist: 7.8, shiftX: 0, shiftY: -0.03, fitA: 0.72 }),
    introOpen: M({ ...stepBase, ...EX(6), tz: 1.0, dist: 13.2, tags: 0, shiftX: 0, shiftY: -0.14 }, { shiftY: 0.05, fitA: 0.8 }),
    heroHidden: M({ rx: -30, ry: -20, el: 6, dist: 7.6, fitA: 1.0, shiftY: -0.27, tx: 0, ty: 0, tz: 0, strap: 0.35, rim: 1.15, vis: 0 }, { shiftY: -0.02, fitA: 0.85 }),
    approach: M({ rx: -30, ry: -20, el: 6, dist: 6.4, fitA: 1.0, shiftY: -0.27, tx: 0, ty: 0, tz: 0, strap: 0.35, rim: 1.15 }, { shiftY: -0.02, fitA: 0.85 }),
    steps: stepsP,
    mats: [
      [mp(m1a), mp({ ...m1a, dist: 2.75, key: 55 })],
      [mp(m2a), mp({ ...m2a, dist: 2.5, az: -62 })],
      [mp(m3a), mp({ ...m3a, dist: 1.6, az: 40 })],
      [mp(m4a), mp({ ...m4a, dist: 2.85, az: -6 })]
    ],
    rA: M({ ...stepBase, ...EX(6), tz: 0.95, dist: 11.0, tags: 0, beam: 0.3 }, stepMob),
    rMid: M({ ...EX(6, 0.3), rx: -36, ry: -26, el: 8, dist: 9.2, tz: 0.4, ty: 0, strap: 0, rim: 3.2, fitA: 1.0, shiftY: -0.2 }, { shiftY: -0.12, fitA: 0.8 }),
    rEnd: M({ rx: -12, ry: -34, el: 2, dist: 8.4, shiftY: -0.2, ty: 0.1, spin: 0 }, { shiftY: -0.14, fitA: 1.15 }),
    det, exp, expHidden: { ...exp, vis: 0 },
    chipA, chipB, chipAHidden: { ...chipA, vis: 0 }, chipBHidden: { ...chipB, vis: 0 },
    close, closeHidden: { ...close, vis: 0 }
  };
}

/* ---------------- 3D ---------------- */
const S = { ...DEF, vis: 0, screen: 1 };
// giro de entrada da hero: 0 = começando, 1 = pousado
const intro = { t0: 0, s: 0 };
let introScr = 1;
const lerp = (a, b, k) => a + (b - a) * k;
const eio = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
function heroIn() { root.classList.add('hero-in'); }
// chega reto e apagado, com luz baixa; depois gira até ficar de lado e só então o texto aparece
function introPose() {
  if (!intro.t0) { introScr = 1; return S; }
  const s = intro.s, A = 0.3, B = 0.7;
  if (s >= A + B) { intro.t0 = 0; introScr = 1; heroIn(); return S; }
  const F = { rx: -6, ry: -12, rz: 0, el: 2, shiftX: 0, shiftY: S.shiftY + 0.04, dist: S.dist + 0.8 };
  let k, vis, scr, d0;
  if (s < A) { const u = Math.max(0, s / A); k = 0; vis = 0.45 * (1 - Math.pow(1 - u, 2)); scr = 0; d0 = lerp(S.dist + 3.2, F.dist, 1 - Math.pow(1 - u, 3)); }
  else { const u = (s - A) / B; k = eio(u); vis = lerp(0.45, 1, k); scr = Math.min(1, u * 1.6); d0 = F.dist; }
  introScr = scr;
  return { ...S, rx: lerp(F.rx, S.rx, k), ry: lerp(F.ry, S.ry, k), rz: lerp(F.rz, S.rz, k), el: lerp(F.el, S.el, k),
    shiftX: lerp(F.shiftX, S.shiftX, k), shiftY: lerp(F.shiftY, S.shiftY, k), dist: lerp(d0, S.dist, k), vis: S.vis * vis };
}
let three = null, running = false, rafOn = false, master = null, masterST = null, passes = [], frameRange = null;
if (stillDebug) window.__volt = { S, get L() { return L; }, get tl() { return master; } };
let canvas = $('#gl');
const par = { x: 0, y: 0 }, parT = { x: 0, y: 0 };
let screenFlash = 1, flashTween = null;
let dpr = 1, frames = [], lastFrameT = 0, idleSkip = false, lastScrub = 0;
const tags = [];
const fx = { rx: 0, ry: 0, zoom: 1, tx: 0, ty: 0, tz: 0 };

function flashScreen() {
  if (!faceCanvas || !window.gsap || mqReduce.matches) { paintFaces(); return; }
  if (flashTween) flashTween.kill();
  const o = { v: screenFlash };
  flashTween = gsap.timeline()
    .to(o, { v: 0.08, duration: 0.14, ease: 'power2.in', onUpdate: () => { screenFlash = o.v; invalidate(); } })
    .add(() => paintFaces())
    .to(o, { v: 1, duration: 0.35, ease: 'power2.out', onUpdate: () => { screenFlash = o.v; invalidate(); } });
}

function buildTags() {
  overlay.querySelectorAll('.tag').forEach(t => t.remove());
  tags.length = 0;
  const names = R().tags;
  for (let p = 0; p < 6; p++) {
    const t = document.createElement('div'); t.className = 'tag';
    t.innerHTML = `<i></i><span>${names[p]}</span>`;
    overlay.appendChild(t);
    tags.push({ el: t, x: -1, y: -1, o: -1, a: null });
  }
}

function sizeCanvas() {
  if (!three) return;
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  const base = tier === 'high' ? Math.min(devicePixelRatio || 1, 2) : Math.min(devicePixelRatio || 1, 1.6);
  dpr = Math.min(dpr || base, base);
  three.resize(w, h, dpr);
  invalidate();
}

function buildMaster() {
  if (!three || !window.gsap) return;
  if (masterST) { masterST.kill(); masterST = null; }
  if (master) { master.kill(); master = null; }
  measure();
  const P = buildPoses(mqMobile.matches);
  const vh = L.vh, I = L.intro, Mt = L.mat, R = L.rebuild, D = L.det, X = L.exp, Sp = L.specs, C = L.close;
  const K = [];
  const add = (y, pose, ease) => K.push([y, pose, ease]);
  // cada seção tem o seu relógio: ele rola junto com a seção e some na metade da passagem,
  // e o da seção seguinte entra subindo, já na pose dela (nada atravessa de uma seção para outra)
  const H = o => ({ ...o, vis: 0, tags: 0 });
  const T = [];
  const pass = (a, b, from, to) => { const m = (a + b) / 2; T.push([a, b]); add(m - 1, H(from)); add(m, H(to)); add(b, to); };
  const end = s => s.top + s.r;
  add(0, P.hero);
  pass(0, I.top, P.hero, P.approach);
  // nesta seção o relógio se desmonta aos poucos, pronto para a seção seguinte
  add(I.top + 0.25 * I.r, P.approach);
  add(end(I), P.introOpen, 'power1.inOut');
  // o mesmo relógio aberto segue para a seção seguinte, sem sumir
  add(Mt.top, P.mats[0][0], 'power2.inOut');
  for (let i = 0; i < 4; i++) {
    add(Mt.top + (i + 0.28) * L.matLen, P.mats[i][0], 'power2.inOut');
    add(Mt.top + (i + 0.86) * L.matLen, P.mats[i][1], 'sine.inOut');
  }
  add(end(Mt), P.mats[3][1]);
  pass(end(Mt), R.top, P.mats[3][1], P.rA);
  add(R.top + 0.5 * R.r, P.rMid, 'power2.in');
  add(R.top + 0.94 * R.r, P.rEnd, 'power2.out');
  add(end(R) - vh * 0.3, P.rEnd);
  add(end(R) - 1, H(P.rEnd), 'power1.in');
  // detalhes em diante: o relógio é uma foto dentro de cada seção, o 3D fica apagado
  add(end(R), H(P.rEnd));
  frameRange = null;
  passes = T;
  // troca de cena por um apagar e acender, sem a câmera atravessar o espaço
  // o relógio da experiência apaga antes da seção de recursos (fotos); o chip só acende nas especificações
  add(L.max, H(P.rEnd));
  K.sort((a, b) => a[0] - b[0]);
  const tl = gsap.timeline({ paused: true, onUpdate: () => { lastScrub = performance.now(); invalidate(); } });
  for (let i = 0; i < K.length - 1; i++) {
    const [ya, pa] = K[i], [yb, pb, ease] = K[i + 1];
    const d = yb - ya;
    if (d <= 0.5) continue;
    tl.fromTo(S, { ...pa }, { ...pb, duration: d, ease: ease || 'power2.inOut', immediateRender: false }, ya);
  }
  tl.set({}, {}, L.max);
  master = tl;
  masterST = ScrollTrigger.create({ start: 0, end: L.max, animation: tl, scrub: mqMobile.matches ? 0.5 : 0.85 });
  tl.progress(clamp(scrollY / L.max));
  onScrollUI();
  invalidate();
}

// desloca o palco 3D junto com a rolagem nas passagens entre seções
let lastFrame = '';
// na seção de detalhes o palco 3D fica recortado na caixa preta e rola junto com ela na entrada e na saída
function frameShift() {
  let tf = '', cp = '';
  if (master && L && frameRange) {
    const y = master.progress() * L.max, [a, b, c, d] = frameRange;
    if (y >= a && y <= d) {
      // o relógio não se move: a caixa desliza e funciona como uma janela por cima dele
      const off = Math.round(y < b ? b - y : y > c ? -(y - c) : 0);
      const st = sec.det.querySelector('.sticky'), cs = getComputedStyle(st, '::before');
      const T0 = parseFloat(cs.top) + off, B0 = parseFloat(cs.bottom) - off;
      if (!mqMobile.matches) cp = `inset(${Math.max(0, T0)}px ${cs.right} ${Math.max(0, B0)}px ${cs.left} round ${cs.borderTopLeftRadius})`;
    }
  }
  const k = tf + '|' + cp;
  if (k !== lastFrame) { lastFrame = k; glWrap.style.transform = tf; glWrap.style.clipPath = cp; }
}
let lastShift = null;
const ZP = { x: 0, y: 0 };
function passShift() {
  if (!master || !L) return;
  const y = master.progress() * L.max;
  let off = 0;
  for (const [a, b] of passes) {
    if (y > a && y < b) { const m = (a + b) / 2; off = y < m ? -(y - a) : (b - y); break; }
  }
  off = Math.round(off);
  if (off !== lastShift) { lastShift = off; glWrap.style.transform = off ? `translate3d(0,${off}px,0)` : ''; }
}
function invalidate() {
  if (!running || rafOn) return;
  rafOn = true; requestAnimationFrame(loop);
}
const glWrap = $('#glwrap');
let lastCanvasOp = -1;
function loop(t) {
  rafOn = false;
  if (!running || !three) return;
  const dt = lastFrameT ? t - lastFrameT : 16; lastFrameT = t;
  const k = 1 - Math.pow(1 - 0.08, Math.min(100, dt) / 16.667);
  par.x += (parT.x - par.x) * k; par.y += (parT.y - par.y) * k;
  if (intro.t0) intro.s += Math.min(dt, 60) / 1000; // passo limitado: em aparelho lento a entrada fica mais lenta, nunca pula
  const RS = introPose();
  frameShift();
  const op = Math.round(clamp(RS.vis) * 1000) / 1000;
  if (op !== lastCanvasOp) { lastCanvasOp = op; glWrap.style.opacity = op; }
  const visible = op > 0.003;
  const still = mqReduce.matches || stillDebug;
  const animating = (!still && (S.spin > 0.01 || S.set > 0.5)) || three.isAnimating() || !!intro.t0;
  const parMoving = Math.abs(parT.x - par.x) + Math.abs(parT.y - par.y) > 0.0008;
  if (visible) {
    S.screen = screenFlash * (faceMode === 'noite' ? 0.6 : 1);
    // movimento ocioso a ~30 fps para poupar bateria; rolagem e interação vão a 60
    if (!(idleSkip && animating && !intro.t0 && !parMoving && t - lastScrub > 150)) {
      if (RS !== S) RS.screen = S.screen * introScr;
      three.render(RS, still ? 0 : t, ZP, fx);
      updateOverlay();
      trackPerf(dt);
    }
    idleSkip = !idleSkip;
  }
  if (visible && !document.hidden && (animating || parMoving)) { rafOn = true; requestAnimationFrame(loop); }
  else lastFrameT = 0;
}
function trackPerf(dt) {
  if (dt > 200) return;
  frames.push(dt);
  if (frames.length < 90) return;
  const avg = frames.reduce((a, b) => a + b, 0) / frames.length; frames = [];
  if (avg > 30 && dpr > 1) { dpr = Math.max(1, dpr - 0.35); three.lowerQuality(); sizeCanvas(); }
}

function updateOverlay() {
  const out = three.out;
  const show = S.tags;
  // leitura de layout primeiro, escrita depois: a linha liga a peça ativa à coluna de camadas
  let d = '';
  if (activeStep >= 0 && show > 0.5 && innerWidth > 900) {
    const r = gaugeItems[activeStep].getBoundingClientRect();
    const a = out.anchors[STEP_PART[activeStep]];
    if (r.width && r.top > 0 && r.bottom < innerHeight) {
      const x0 = a.x + 10, y0 = a.y, x2 = r.left - 10, y2 = r.top + r.height / 2;
      const x1 = Math.min(x0 + 48, x2 - 30);
      d = `M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y0.toFixed(1)} L${(x2 - 18).toFixed(1)} ${y2.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
  }
  if (d !== callout.__d) { callout.__d = d; callout.setAttribute('d', d); }
  for (let p = 0; p < 6; p++) {
    const t = tags[p], a = out.anchors[p];
    const o = Math.round(clamp(show * clamp(S['e' + p] * 1.6)) * 100) / 100;
    if (o !== t.o) { t.o = o; t.el.style.opacity = o; }
    if (o > 0) {
      const x = Math.round(a.x * 2) / 2, y = Math.round(a.y * 2) / 2;
      if (x !== t.x || y !== t.y) {
        t.x = x; t.y = y;
        const flip = innerWidth <= 900 && x > innerWidth * 0.62;
        if (flip !== t.f) { t.f = flip; t.el.classList.toggle('flip', flip); }
        t.el.style.transform = flip ? `translate3d(calc(${x}px - 100%),${y - 6}px,0)` : `translate3d(${x}px,${y - 6}px,0)`;
      }
    }
    const act = activeStep >= 0 && STEP_PART[activeStep] === p;
    if (act !== t.a) { t.a = act; t.el.classList.toggle('is-active', act); }
  }
}

function onPointer(e) {
  if (e.pointerType !== 'mouse' || mqReduce.matches) return;
  parT.x = (e.clientX / innerWidth - 0.5) * 2;
  parT.y = (e.clientY / innerHeight - 0.5) * 2;
  invalidate();
}
let resizeT = 0, lastW = innerWidth, lastH = innerHeight;
function onResize() {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    const w = innerWidth, h = innerHeight;
    // em celular, a barra de endereço muda só a altura: ignora mudanças pequenas
    if (w === lastW && Math.abs(h - lastH) < 140 && matchMedia('(pointer: coarse)').matches) return;
    lastW = w; lastH = h;
    sizeCanvas(); buildMaster();
  }, 220);
}

async function fontsReady() {
  try { await Promise.race([Promise.all([document.fonts.load('600 40px Sora'), document.fonts.load('500 40px Inter'), document.fonts.load('600 40px Inter')]), new Promise(r => setTimeout(r, 2500))]); }
  catch (e) { /* segue com a fonte de reserva */ }
}

let textTweens = [];
function buildTextScrubs() {
  textTweens.forEach(t => { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); }); textTweens = [];
  $$('.intro h2 .w, [data-intro-sub], .rebuild .l1, .rebuild .l2, .mat__head').forEach(el => el.removeAttribute('style'));
  if (no3d || !window.gsap || mqReduce.matches) return;
  const words = $$('.intro h2 .w');
  const sub = $('[data-intro-sub]');
  const t1 = gsap.timeline({ scrollTrigger: { trigger: sec.intro, start: 'top 75%', end: 'bottom bottom', scrub: 0.6 } });
  t1.fromTo(words, { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.06, duration: 0.3, ease: 'power3.out' }, 0)
    .fromTo(sub, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.2 }, 0.22)
    .to([...words, sub], { opacity: 0, y: -24, yPercent: 0, duration: 0.18, stagger: 0.01, ease: 'power2.in' }, 0.82);
  const l1 = $('.rebuild .l1'), l2 = $('.rebuild .l2');
  const t2 = gsap.timeline({ scrollTrigger: { trigger: sec.rebuild, start: 'top 70%', end: 'bottom bottom', scrub: 0.6 } });
  t2.fromTo(l1, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power3.out' }, 0.05)
    .fromTo(l2, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power3.out' }, 0.45)
    .to({}, { duration: 0.3 }, 0.7);
  const head = $('.mat__head');
  const t3 = gsap.fromTo(head, { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'power2.out', scrollTrigger: { trigger: sec.mat, start: 'top 60%', end: 'top 10%', scrub: 0.6 } });
  textTweens.push(t1, t2, t3);
}

let booting = false;
async function init3D() {
  if (three || no3d || booting) return;
  booting = true;
  try { await boot3D(); } finally { booting = false; }
}
async function boot3D() {
  root.classList.add('is-3d-loading');
  await fontsReady();
  let mod;
  try { mod = await import('./watch.js?v=32'); } catch (e) { console.warn('VOLT: 3D indisponível', e); goStatic(); return; }
  faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = tier === 'high' ? 2048 : 1536;
  drawFace(faceCanvas, faceMode, new Date(), lang);
  const fresh = canvas.cloneNode(false); canvas.replaceWith(fresh); canvas = fresh;
  try { three = mod.createWatch(canvas, { faceCanvas, tier, backText: R().back }); }
  catch (e) { console.warn('VOLT: falha no WebGL', e); three = null; goStatic(); return; }
  canvas.addEventListener('webglcontextlost', ev => { ev.preventDefault(); goStatic(); }, { once: true });
  buildTags();
  initDet3D(mod);
  initChip3D(mod);
  dpr = 0; sizeCanvas();
  running = true;
  if (window.gsap) { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.config({ ignoreMobileResize: true }); if (stillDebug) gsap.ticker.lagSmoothing(0); }
  buildMaster();
  buildTextScrubs();
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('resize', onResize);
  renderCrown();
  if (window.gsap && !mqReduce.matches && !stillDebug && scrollY < innerHeight * 0.5) {
    intro.t0 = 1; intro.s = 0;
  } else heroIn();
  invalidate();
  requestAnimationFrame(() => requestAnimationFrame(() => { root.classList.remove('is-3d-loading'); root.classList.add('is-3d-ready'); }));
}

/* sem WebGL (ou se o contexto cair): versão estática completa, sem aviso nem botão */
function goStatic() {
  heroIn();
  no3d = true;
  running = false;
  removeEventListener('pointermove', onPointer);
  removeEventListener('resize', onResize);
  if (masterST) { masterST.kill(); masterST = null; }
  if (master) { master.kill(); master = null; }
  buildTextScrubs();
  if (three) { three.dispose(); three = null; }
  tags.forEach(t => t.el.remove()); tags.length = 0;
  callout.setAttribute('d', ''); callout.__d = '';
  root.classList.remove('is-3d-ready', 'is-3d-loading');
  root.classList.add('no3d');
  measure(); onScrollUI();
  addEventListener('resize', () => { measure(); onScrollUI(); });
}

mqMobile.addEventListener('change', () => { if (three) buildMaster(); });
mqReduce.addEventListener('change', () => { if (three) { buildTextScrubs(); invalidate(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
addEventListener('load', () => { if (three) buildMaster(); });

/* ---------------- detalhes: um item aberto por vez, com foco no relógio ---------------- */
// cada item gira e aproxima o relógio até a parte de que fala (deslocamentos somados à pose da rolagem)
const FOCUS = {
  base: { rx: 0, ry: 0, zoom: 1, tx: 0, ty: 0, tz: 0 },
  finish: { rx: -6, ry: 34, zoom: 0.86, tx: 0, ty: 0.05, tz: 0 },
  size: { rx: 4, ry: 18, zoom: 1.12, tx: 0, ty: 0, tz: 0 },
  crown: { rx: 2, ry: -38, zoom: 0.5, tx: 1.0, ty: 0.12, tz: 0.4 },
  button: { rx: -6, ry: -48, zoom: 0.56, tx: 1.0, ty: -0.3, tz: 0.3 },
  durable: { rx: 8, ry: -62, zoom: 0.82, tx: 0.2, ty: 0, tz: 0.4 },
  charge: { rx: 10, ry: 168, zoom: 0.74, tx: 0, ty: 0, tz: 0.4 },
  strap: { rx: 46, ry: -14, zoom: 1.18, tx: 0, ty: -0.7, tz: 0.2 }
};
const feats = $$('.feat');
let fxTween = null, curFocus = 'finish', detVisible = true;
// relógio 3D próprio da seção de detalhes: vive dentro da caixa e só se mexe nos cliques
const dfx = { rx: 0, ry: 0, zoom: 1, tx: 0, ty: 0, tz: 0 };
let det3 = null, detCanvas = null, detOn = false, detRaf = false, detUntil = 0;
const DET_POSE = () => ({ ...DEF, rx: -10, ry: -30, el: 2, dist: 8.2, ty: 0.05, tz: -0.6, shiftX: 0, shiftY: 0, fitA: 1, spin: 0, glassI: 0.3, bgMix: 1, strap: 0, vis: 1, screen: 1 });
function detFrame() {
  detRaf = false;
  if (!det3 || !detOn) return;
  det3.render(DET_POSE(), performance.now(), ZP, dfx);
  if (performance.now() < detUntil) { detRaf = true; requestAnimationFrame(detFrame); }
}
function detKick(ms = 400) { detUntil = Math.max(detUntil, performance.now() + ms); if (det3 && detOn && !detRaf) { detRaf = true; requestAnimationFrame(detFrame); } }
function detSize() {
  if (!det3) return;
  const w = detCanvas.clientWidth, h = detCanvas.clientHeight; if (!w || !h) return;
  det3.resize(w, h, Math.min(devicePixelRatio || 1, tier === 'high' ? 2 : 1.5)); detKick();
}
function initDet3D(mod) {
  const shot = $('.det__shot'); if (!shot || det3) return;
  detCanvas = document.createElement('canvas'); detCanvas.className = 'det__gl'; shot.appendChild(detCanvas);
  try { det3 = mod.createWatch(detCanvas, { faceCanvas, tier, backText: R().back }); } catch (e) { detCanvas.remove(); det3 = null; return; }
  shot.classList.add('is-3d');
  detSize(); addEventListener('resize', detSize);
  new IntersectionObserver(es => { detOn = es[0].isIntersecting; detKick(900); }, { rootMargin: '200px 0px' }).observe(shot);
}
// cada opção tem o seu movimento: giro até a coroa, ao botão, ao perfil, à traseira, à pulseira
const FOCUS_EASE = { finish: 'power2.inOut', crown: 'back.out(1.25)', button: 'back.out(1.15)', durable: 'power3.inOut', charge: 'power4.inOut', strap: 'expo.inOut', base: 'power3.inOut' };
const FOCUS_DUR = { finish: 1.6, crown: 1.5, button: 1.4, durable: 1.7, charge: 2.1, strap: 1.8, base: 1.4 };
function focusTo(key) {
  const f = FOCUS[key] || FOCUS.base;
  if (fxTween) fxTween.kill();
  if (!det3 || !window.gsap || mqReduce.matches) { Object.assign(dfx, f); detKick(); return; }
  const d = FOCUS_DUR[key] || 1.5; detKick(d * 1000 + 150);
  fxTween = gsap.to(dfx, { ...f, duration: d, ease: FOCUS_EASE[key] || 'power3.inOut', onComplete: () => detKick(250) });
}
function openFeat(el) {
  feats.forEach(f => {
    const open = f === el && !f.classList.contains('open');
    f.classList.toggle('open', open);
    f.querySelector('.feat__btn').setAttribute('aria-expanded', String(open));
  });
  curFocus = el.classList.contains('open') ? el.dataset.focus : 'base';
  if (detShot && !det3) detShot.dataset.f = curFocus;
  focusTo(curFocus);
}
feats.forEach(f => f.querySelector('.feat__btn').addEventListener('click', () => openFeat(f)));
const detShot = $('.det__shot'), detImgs = $$('.det__shot img');
$$('.swatch').forEach(b => b.addEventListener('click', () => {
  $$('.swatch').forEach(s => s.setAttribute('aria-pressed', String(s === b)));
  detImgs.forEach((im, k) => im.classList.toggle('is-active', k === +b.dataset.finish));
  if (three) { three.setFinish(+b.dataset.finish); invalidate(); }
  if (det3) { det3.setFinish(+b.dataset.finish); detKick(2600); }
}));

/* especificações: a placa 3D vive na faixa do topo; recua (zoom out) uma vez em 3 s e para */
let chip3 = null, chipCv = null, chipT0 = 0, chipVis = false, chipRaf = false;
const CHIP_POSE = (k) => { const m = mqMobile.matches; const d = m ? 4.6 : 3.9; return { ...DEF, set: 1, tx: 0, ty: 0, tz: 0, el: 58, az: 0, dist: d * (0.42 + 0.58 * k), fitA: 1, spin: 0, rim: 1.25 + 0.5 * (1 - k), bglow: 1, vis: 1, screen: 1, shiftX: 0, shiftY: 0 }; };
function chipFrame(now) {
  chipRaf = false; if (!chip3) return;
  const u = chipT0 ? Math.min(1, (now - chipT0) / 3000) : 0, k = 1 - Math.pow(1 - u, 3);
  chip3.render(CHIP_POSE(k), now, ZP);
  // o zoom acontece uma vez; depois a câmera fica parada e só o circuito pulsa, enquanto a faixa está na tela
  if (chipT0 && (u < 1 || (chipVis && !mqReduce.matches && !document.hidden))) { chipRaf = true; requestAnimationFrame(chipFrame); }
}
function chipSize() { if (!chip3) return; const w = chipCv.clientWidth, h = chipCv.clientHeight; if (!w || !h) return; chip3.resize(w, h, Math.min(devicePixelRatio || 1, tier === 'high' ? 2 : 1.5)); if (!chipRaf) requestAnimationFrame(chipFrame); }
function initChip3D(mod) {
  const band = $('.specs__chip'); if (!band || chip3) return;
  chipCv = document.createElement('canvas'); chipCv.className = 'specs__gl'; band.appendChild(chipCv);
  try { chip3 = mod.createWatch(chipCv, { faceCanvas, tier, backText: R().back }); } catch (e) { chipCv.remove(); chip3 = null; return; }
  if (chip3.setChipRim) chip3.setChipRim(false);
  band.classList.add('is-3d'); chipSize(); addEventListener('resize', chipSize);
  new IntersectionObserver(es => es.forEach(e => { chipVis = e.isIntersecting; if (!chipVis) return; band.classList.add('in'); if (!chipT0) chipT0 = mqReduce.matches ? 1 : performance.now(); if (!chipRaf) { chipRaf = true; requestAnimationFrame(chipFrame); } }), { threshold: 0.15 }).observe(band);
}
{ const chip = $('.specs__chip'); if (chip) new IntersectionObserver((es, ob) => es.forEach(e => { if (e.isIntersecting) { chip.classList.add('in'); ob.disconnect(); } }), { threshold: 0.35 }).observe(chip); }
/* início */
setTimeout(() => { if (!three) heroIn(); }, 9000); // garantia: o texto da hero aparece mesmo se o 3D não subir
applyLang(lang, true);
if (no3d) goStatic();
else (window.requestIdleCallback || (f => setTimeout(f, 60)))(() => init3D(), { timeout: 600 });

/* ---------------- recursos: carrossel que passa sozinho ou pelos controles ----------------
   A rolagem da página não troca os cards. Ele pausa com o mouse em cima, com foco,
   ao tocar, fora da tela e quando o sistema pede menos movimento. */
(function feats() {
  const root = $('#recursos'); if (!root) return;
  const track = $('#featsTrack'), cards = $$('.fcard', track), dots = $$('#featsDots button');
  const btnPlay = $('#featsPlay'), DUR = 5500;
  let idx = 0, timer = 0, userPaused = false, hover = false, inView = false;
  const cardX = i => cards[i].offsetLeft - track.firstElementChild.offsetLeft;
  function mark(i) {
    idx = i;
    dots.forEach((d, k) => { d.classList.toggle('on', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    // reinicia a barra de progresso do ponto ativo
    const bar = dots[i] && dots[i].querySelector('i'); if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
  }
  function go(i, smooth = true) {
    const n = cards.length; i = (i + n) % n;
    track.scrollTo({ left: cardX(i), behavior: smooth && !mqReduce.matches ? 'smooth' : 'auto' });
    mark(i); schedule();
  }
  function playing() { return !userPaused && !hover && inView && !document.hidden; }
  function schedule() {
    clearTimeout(timer);
    root.classList.toggle('playing', playing());
    if (playing()) timer = setTimeout(() => go(idx + 1), DUR);
  }
  function setPaused(p) {
    userPaused = p; btnPlay.classList.toggle('paused', p);
    const k = p ? 'featsPlay' : 'featsPause'; btnPlay.dataset.i18nAria = k;
    btnPlay.setAttribute('aria-label', (window.__voltT && window.__voltT(k)) || (p ? 'Reproduzir' : 'Pausar'));
    schedule();
  }
  // o usuário arrastou: o card mais próximo vira o ativo
  let st = 0;
  track.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(() => {
    let best = 0, bd = Infinity; cards.forEach((c, k) => { const d = Math.abs(cardX(k) - track.scrollLeft); if (d < bd) { bd = d; best = k; } });
    const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    if (best !== idx && !(atEnd && idx > best)) { mark(best); schedule(); }
  }, 120); }, { passive: true });
  $('#featsPrev').addEventListener('click', () => go(idx - 1));
  $('#featsNext').addEventListener('click', () => go(idx + 1));
  btnPlay.addEventListener('click', () => setPaused(!userPaused));
  dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
  track.addEventListener('touchstart', () => { if (!userPaused) setPaused(true); }, { passive: true });
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(es => { inView = es[0].isIntersecting; schedule(); }, { threshold: 0.35 }).observe(root);
  root.style.setProperty('--dur', DUR + 'ms');
  mark(0); setPaused(userPaused);
})();
