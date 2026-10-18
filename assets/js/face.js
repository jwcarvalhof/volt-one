/* Mostradores do VOLT One, desenhados em canvas 2D, em PT e EN.
   O mesmo desenho vira textura da tela 3D e também aparece direto na página quando não há WebGL.
   Todos os números são ilustrativos: interface conceitual, não leituras reais. */

export const MODES = ['hora', 'dia', 'treino', 'foco', 'noite'];
const L10N = {
  pt: {
    days: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'],
    months: ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'],
    goal: 'META', today: 'KM HOJE', dist: '8,4', next: 'PRÓXIMO', event: 'Revisão de design', where: '09:30  ·  sala 4', steps: '6.240 passos',
    run: 'CORRIDA AO AR LIVRE', km: '5,24', pace: 'RITMO /KM', time: 'TEMPO', effort: 'Esforço moderado',
    focus: 'FOCO', paused: 'Avisos em pausa até 10:15', night: 'Brilho mínimo  ·  alarme 06:40'
  },
  en: {
    days: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    months: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    goal: 'GOAL', today: 'KM TODAY', dist: '8.4', next: 'NEXT', event: 'Design review', where: '09:30  ·  room 4', steps: '6,240 steps',
    run: 'OUTDOOR RUN', km: '5.24', pace: 'PACE /KM', time: 'TIME', effort: 'Moderate effort',
    focus: 'FOCUS', paused: 'Alerts paused until 10:15', night: 'Minimum brightness  ·  alarm 06:40'
  }
};
const BLUE = '#2f6dff', GLOW = '#6B9BFF', WHITE = '#eef2fa', GREY = '#91A0BA';
const pad = n => String(n).padStart(2, '0');

function base(x, S, dim = 1) {
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  const g = x.createRadialGradient(S / 2, S * 0.44, 20, S / 2, S / 2, S * 0.52);
  g.addColorStop(0, `rgba(14,26,52,${0.9 * dim})`); g.addColorStop(0.65, `rgba(4,8,16,${dim})`); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.translate(S / 2, S / 2);
  x.scale(S / 1024, S / 1024);
}
function txt(x, s, px, y, size, weight, color, family = 'Inter', align = 'center', spacing = 0) {
  x.font = `${weight} ${size}px ${family}, Arial, sans-serif`;
  x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle';
  if ('letterSpacing' in x) x.letterSpacing = spacing + 'px';
  x.fillText(s, px, y);
  if ('letterSpacing' in x) x.letterSpacing = '0px';
}
function arc(x, r, w, from, to, color, glow = 0) {
  x.save(); x.lineCap = 'round'; x.lineWidth = w; x.strokeStyle = color;
  if (glow) { x.shadowColor = GLOW; x.shadowBlur = glow; }
  x.beginPath(); x.arc(0, 0, r, -Math.PI / 2 + from * Math.PI * 2, -Math.PI / 2 + to * Math.PI * 2); x.stroke(); x.restore();
}
function hand(x, angle, len, tail, w, color, inner) {
  x.save(); x.rotate(angle);
  x.fillStyle = color; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 12;
  x.beginPath(); x.roundRect(-w / 2, -len, w, len + tail, w / 2); x.fill();
  if (inner) { x.shadowBlur = 0; x.fillStyle = inner; x.beginPath(); x.roundRect(-w * 0.18, -len + w, w * 0.36, len * 0.55, w * 0.18); x.fill(); }
  x.restore();
}

function hora(x, now, t) {
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    x.save(); x.rotate(i * Math.PI / 30); x.fillStyle = '#243049'; x.fillRect(-1.5, -488, 3, 18); x.restore();
  }
  for (let i = 0; i < 12; i++) {
    if (i === 3 || i === 6 || i === 9) continue;
    x.save(); x.rotate(i * Math.PI / 6);
    x.shadowColor = BLUE; x.shadowBlur = 22; x.fillStyle = BLUE;
    x.beginPath(); x.roundRect(-5, -488, 10, i === 0 ? 92 : 70, 5); x.fill(); x.restore();
  }
  txt(x, 'VOLT', 0, -262, 66, 600, '#dfe6f3', 'Sora', 'center', 12);
  txt(x, 'ONE', 0, -205, 26, 500, GREY, 'Inter', 'center', 8);
  txt(x, `${t.days[now.getDay()]} ${now.getDate()}`, -300, 0, 36, 500, '#c9d3e6', 'Inter', 'center', 3);
  x.save(); x.translate(285, 0);
  x.fillStyle = '#070b14'; x.beginPath(); x.arc(0, 0, 92, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#18233a'; x.lineWidth = 7; x.beginPath(); x.arc(0, 0, 82, 0, Math.PI * 2); x.stroke();
  arc(x, 82, 7, 0, 0.68, BLUE, 14);
  txt(x, '68%', 0, -6, 40, 600, WHITE);
  txt(x, t.goal, 0, 34, 18, 500, GREY, 'Inter', 'center', 4);
  x.restore();
  x.save(); x.translate(0, 285);
  x.fillStyle = '#070b14'; x.beginPath(); x.arc(0, 0, 92, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#18233a'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 88, 0, Math.PI * 2); x.stroke();
  txt(x, t.dist, 0, -8, 44, 600, WHITE);
  txt(x, t.today, 0, 32, 17, 500, GREY, 'Inter', 'center', 3);
  x.restore();
  const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();
  hand(x, (h + m / 60) * Math.PI / 6, 262, 40, 22, '#dfe5f1', '#0b1222');
  hand(x, (m + s / 60) * Math.PI / 30, 392, 40, 16, '#eef2fa', '#0b1222');
  x.save(); x.rotate(s * Math.PI / 30);
  x.shadowColor = BLUE; x.shadowBlur = 16; x.fillStyle = BLUE; x.fillRect(-2.5, -440, 5, 530); x.restore();
  x.fillStyle = BLUE; x.beginPath(); x.arc(0, 0, 20, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#04070d'; x.beginPath(); x.arc(0, 0, 9, 0, Math.PI * 2); x.fill();
}

function dia(x, now, t) {
  arc(x, 470, 12, 0, 1, '#121a2c');
  arc(x, 470, 12, 0, 0.62, BLUE, 18);
  txt(x, `${t.days[now.getDay()]} ${now.getDate()} ${t.months[now.getMonth()]}`, 0, -300, 32, 500, GREY, 'Inter', 'center', 5);
  txt(x, `${pad(now.getHours())}:${pad(now.getMinutes())}`, 0, -150, 200, 600, WHITE, 'Sora', 'center', -4);
  x.fillStyle = '#0b1324'; x.beginPath(); x.roundRect(-330, 10, 660, 220, 36); x.fill();
  x.fillStyle = BLUE; x.beginPath(); x.roundRect(-330, 10, 10, 220, 5); x.fill();
  txt(x, t.next, -280, 62, 24, 600, GLOW, 'Inter', 'left', 5);
  txt(x, t.event, -280, 118, 46, 600, WHITE, 'Inter', 'left');
  txt(x, t.where, -280, 178, 32, 500, GREY, 'Inter', 'left');
  txt(x, t.steps, 0, 330, 34, 500, '#c9d3e6');
}

function treino(x, now, t) {
  arc(x, 470, 14, 0, 1, '#121a2c');
  arc(x, 470, 14, 0, 0.71, BLUE, 20);
  txt(x, t.run, 0, -300, 26, 600, GLOW, 'Inter', 'center', 5);
  txt(x, t.km, -30, -120, 210, 600, WHITE, 'Sora', 'center', -6);
  txt(x, 'km', 225, -70, 50, 500, GREY);
  x.fillStyle = '#18233a'; x.fillRect(-330, 30, 660, 3);
  txt(x, '5\'12"', -170, 110, 70, 600, WHITE, 'Sora');
  txt(x, t.pace, -170, 175, 22, 600, GREY, 'Inter', 'center', 4);
  txt(x, '27:18', 170, 110, 70, 600, WHITE, 'Sora');
  txt(x, t.time, 170, 175, 22, 600, GREY, 'Inter', 'center', 4);
  for (let i = 0; i < 5; i++) {
    x.fillStyle = i < 3 ? BLUE : '#18233a';
    if (i < 3) { x.shadowColor = BLUE; x.shadowBlur = 10; } else x.shadowBlur = 0;
    x.beginPath(); x.roundRect(-190 + i * 78, 250, 66, 14, 7); x.fill();
  }
  x.shadowBlur = 0;
  txt(x, t.effort, 0, 312, 28, 500, '#c9d3e6');
}

function foco(x, now, t) {
  arc(x, 360, 18, 0, 1, '#121a2c');
  arc(x, 360, 18, 0, 0.83, BLUE, 22);
  txt(x, t.focus, 0, -170, 30, 600, GLOW, 'Inter', 'center', 8);
  txt(x, '24:59', 0, -10, 170, 600, WHITE, 'Sora', 'center', -4);
  txt(x, t.paused, 0, 130, 32, 500, GREY);
  x.save(); x.translate(0, 270); x.strokeStyle = '#c9d3e6'; x.lineWidth = 6; x.lineCap = 'round';
  x.beginPath(); x.moveTo(-34, 22); x.quadraticCurveTo(-34, -40, 0, -44); x.quadraticCurveTo(34, -40, 34, 22); x.lineTo(-40, 22); x.lineTo(40, 22); x.stroke();
  x.beginPath(); x.moveTo(-46, -50); x.lineTo(46, 40); x.stroke(); x.restore();
}

function noite(x, now, t) {
  x.save(); x.translate(0, -230);
  x.fillStyle = '#2a4a9a'; x.beginPath(); x.arc(0, 0, 46, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#000'; x.beginPath(); x.arc(22, -14, 42, 0, Math.PI * 2); x.fill(); x.restore();
  txt(x, `${pad(now.getHours())}:${pad(now.getMinutes())}`, 0, 0, 190, 500, '#3d63c4', 'Sora', 'center', -4);
  txt(x, t.night, 0, 170, 30, 500, '#2d3f66');
}

export function drawFace(canvas, mode, now = new Date(), lang = 'pt') {
  const x = canvas.getContext('2d');
  const S = canvas.width;
  const t = L10N[lang] || L10N.pt;
  base(x, S, mode === 'noite' ? 0.25 : 1);
  ({ dia, treino, foco, noite }[mode] || hora)(x, now, t);
  x.setTransform(1, 0, 0, 1, 0, 0);
}
