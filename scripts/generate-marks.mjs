// Generates the placeholder "hand-drawn" SVGs in src/marks/.
// These are stand-ins: replace any file in src/marks/ with your own drawing
// (keep the filename, and use fill/stroke="currentColor" so it follows the theme).
// To keep the draw-on animation, give the mark a <path class="pen" pathLength="1">
// in a mask, as the pen marks below do.
//
//   node scripts/generate-marks.mjs
//
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../src/marks/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// --- utilities -------------------------------------------------------------

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(1);
const rand = (a, b) => a + (b - a) * rng();
const lerp = (a, b, t) => a + (b - a) * t;
const f = (n) => Math.round(n * 10) / 10;

// Smooth open curve through points (Catmull-Rom -> cubic Bézier)
function smooth(pts) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

// Filled, tapering "ink" stroke along a list of {x, y, w}
function taper(pts) {
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len, ny = tx / len, h = pts[i].w / 2;
    left.push([pts[i].x + nx * h, pts[i].y + ny * h]);
    right.push([pts[i].x - nx * h, pts[i].y - ny * h]);
  }
  const ring = left.concat(right.reverse());
  return 'M' + ring.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
}

function write(name, svg) {
  writeFileSync(new URL(name, OUT), svg.trim() + '\n');
  console.log('wrote', name, `(${(svg.length / 1024).toFixed(1)} KB)`);
}

// --- neuron growth ---------------------------------------------------------

function makeNeuron() {
  const shapes = [];   // filled tapered branches
  const spines = [];   // tiny ticks along dendrites
  const boutons = [];  // small dots at axon terminals

  function grow({ x, y, angle, len, w0, w1 = 0.35, depth = 0, branchP = 0.02, spread = [0.45, 0.95],
                  wander = 0.12, pull = 0.04, spineP = 0.25, step = 3, bouton = false, maxChild = Infinity, onEnd }) {
    const pts = [];
    const n = Math.max(3, Math.round(len / step));
    let a = angle;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = lerp(w0, w1, Math.pow(t, 0.8));
      pts.push({ x, y, w });
      if (spineP && i > 2 && rng() < spineP) {
        const side = rng() < 0.5 ? 1 : -1;
        const sa = a + side * rand(1.0, 1.9), sl = rand(1.2, 2.8);
        const bx = x + Math.cos(a + side * Math.PI / 2) * w / 2, by = y + Math.sin(a + side * Math.PI / 2) * w / 2;
        spines.push(`M${f(bx)} ${f(by)}l${f(Math.cos(sa) * sl)} ${f(Math.sin(sa) * sl)}`);
      }
      if (depth > 0 && t > 0.15 && t < 0.9 && rng() < branchP) {
        const side = rng() < 0.5 ? 1 : -1;
        grow({ x, y, angle: a + side * rand(...spread), len: Math.min(maxChild, len * (1 - t)) * rand(0.45, 0.85),
               w0: w * 0.7, w1, depth: depth - 1, branchP, spread, wander: wander * 1.6, pull, spineP, step, bouton, maxChild });
      }
      a += (rng() - 0.5) * wander + (angle - a) * pull;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
    }
    shapes.push(taper(pts));
    const end = pts[pts.length - 1];
    if (bouton) boutons.push([end.x, end.y]);
    if (onEnd) onEnd(end, a);
  }

  return { grow, shapes, spines, boutons };
}

function neuronSvg({ viewBox, shapes, spines, boutons, soma, attrs = '' }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${attrs}>
  <g fill="currentColor">
    <path d="${shapes.join('')}"/>
    ${soma ? `<path d="${soma}"/>` : ''}
    ${boutons.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rand(0.9, 1.5))}"/>`).join('')}
  </g>
  ${spines.length ? `<path d="${spines.join('')}" fill="none" stroke="currentColor" stroke-width="0.55" stroke-linecap="round"/>` : ''}
</svg>`;
}

function somaBlob(cx, cy, r, { pyramidal = true } = {}) {
  const pts = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2 - Math.PI / 2; // start at top
    // pyramidal: pointy top, broad flat-ish base
    let rr = r * rand(0.9, 1.08);
    if (pyramidal) rr *= 1 + 0.55 * Math.pow(Math.max(0, -Math.sin(t)), 6) - 0.12 * Math.max(0, Math.sin(t));
    pts.push([cx + Math.cos(t) * rr * (pyramidal ? 0.95 : 1), cy + Math.sin(t) * rr]);
  }
  pts.push(pts[0], pts[1]);
  return smooth(pts) + 'Z';
}

// --- 1. Pyramidal neuron "plate" (tailpiece) -------------------------------
{
  rng = mulberry32(1899);
  const N = makeNeuron();
  const cx = 160, cy = 300;

  // apical dendrite with oblique branches, ending in a tuft
  N.grow({
    x: cx, y: cy - 12, angle: -Math.PI / 2 + 0.03, len: 210, w0: 6, w1: 1.6, depth: 2,
    branchP: 0.09, spread: [0.6, 1.1], wander: 0.1, pull: 0.08, spineP: 0.35, maxChild: 70,
    onEnd: (end, a) => {
      for (let k = 0; k < 4; k++) {
        N.grow({ x: end.x, y: end.y, angle: a + lerp(-0.9, 0.9, k / 3) + rand(-0.15, 0.15),
                 len: rand(45, 75), w0: 1.5, depth: 2, branchP: 0.06, spineP: 0.4 });
      }
    },
  });
  // basal dendrites
  const basal = [-2.6, -2.95, 2.5, 2.05, 1.2, 0.6, 0.25];
  basal.forEach((ang) => {
    const a = ang + rand(-0.1, 0.1);
    N.grow({ x: cx + Math.cos(a) * 9, y: cy + Math.sin(a) * 7 + 4, angle: a, len: rand(60, 105),
             w0: rand(2.2, 3.2), depth: 2, branchP: 0.07, spread: [0.35, 0.8], wander: 0.2, pull: 0.02, spineP: 0.3 });
  });
  // axon: thin, straight, a couple of collaterals, no spines
  N.grow({
    x: cx + 1, y: cy + 12, angle: Math.PI / 2 - 0.02, len: 185, w0: 1.4, w1: 0.6, depth: 1,
    branchP: 0.025, spread: [1.1, 1.4], wander: 0.05, pull: 0.1, spineP: 0, bouton: true,
  });

  const soma = somaBlob(cx, cy, 13);
  write('neuron.svg', neuronSvg({ viewBox: '0 0 320 520', ...N, soma }));
}

// --- 2. Neuron rule: a horizontal divider (long for desktop, short for phones)
function neuronRule(file, width, seed) {
  rng = mulberry32(seed);
  const N = makeNeuron();
  const cx = 32, cy = 26;
  // short dendrites spraying leftwards
  [-2.3, -2.8, 3.0, 2.5, -1.7, 1.8].forEach((a) => {
    N.grow({ x: cx, y: cy, angle: a + rand(-0.12, 0.12), len: rand(16, 30), w0: 2.6, w1: 0.35,
             depth: 1, branchP: 0.18, spread: [0.4, 0.8], wander: 0.25, spineP: 0.3, step: 2 });
  });
  // the long axon
  N.grow({
    x: cx + 7, y: cy, angle: 0, len: width - 90, w0: 1.5, w1: 0.8, depth: 0, wander: 0.05, pull: 0.12, spineP: 0, step: 4,
    onEnd: (end, a) => {
      for (let k = 0; k < 5; k++) {
        N.grow({ x: end.x, y: end.y, angle: a + lerp(-0.9, 0.9, k / 4) + rand(-0.1, 0.1), len: rand(12, 24),
                 w0: 0.8, w1: 0.45, depth: 1, branchP: 0.15, spread: [0.3, 0.6], wander: 0.3, spineP: 0,
                 step: 2, bouton: true });
      }
    },
  });
  const soma = somaBlob(cx, cy, 7, { pyramidal: false });
  write(file, neuronSvg({ viewBox: `0 0 ${width} 52`, ...N, soma, attrs: 'preserveAspectRatio="xMinYMid meet"' }));
}
neuronRule('neuron-rule.svg', 860, 7);
neuronRule('neuron-rule-short.svg', 360, 7);

// --- 3. Pen marks ----------------------------------------------------------
// Each mark is a centreline plus a pressure curve: the nib lands, swells and
// flicks off thinner, so the ink is a filled outline rather than an even
// stroke. A displacement filter roughens the edge like ink on paper, and a
// stroked copy of the centreline in a mask lets the mark draw itself.
// `__uid__` is replaced per instance by Mark.astro so ids stay unique.

const smoothstep = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

// Low-amplitude wobble, like the tremor of a hand
function tremor(amp, freqs = [1.7, 4.3, 9.1]) {
  const phase = freqs.map(() => rand(0, Math.PI * 2));
  return (t) => freqs.reduce((s, fq, i) => s + Math.sin(t * fq * Math.PI * 2 + phase[i]) / (i + 1), 0) * amp;
}

// Wider on strokes across the nib, thinner along it (a broad-ish pen held at an angle)
function nibAngleFactor(dx, dy, nibAngle = -0.7, contrast = 0.35) {
  const a = Math.atan2(dy, dx);
  return 1 - contrast + contrast * Math.abs(Math.sin(a - nibAngle));
}

function inkStroke({ centre, pressure, nib, samples = 160, contrast = 0.3 }) {
  const pts = [];
  for (let i = 0; i <= samples; i++) pts.push(centre(i / samples));
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lengths[lengths.length - 1];
  const inked = pts.map(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return { x, y, w: nib * pressure(lengths[i] / total) * nibAngleFactor(b[0] - a[0], b[1] - a[1], -0.7, contrast) };
  });
  return {
    outline: taper(inked),
    cap: inked[0],
    centreline: 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L'),
    nib,
  };
}

function penSvg({ file, width, height, strokes, roughness = 0.7, seed = 2, attrs = '' }) {
  write(file, `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ${attrs}>
  <defs>
    <filter id="ink-__uid__" x="-5%" y="-50%" width="110%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" result="grain"/>
      <feDisplacementMap in="SourceGraphic" in2="grain" scale="${roughness}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <mask id="pen-__uid__" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
      ${strokes.map((s) => `<path class="pen" d="${s.centreline}" fill="none" stroke="#fff" stroke-width="${f(s.nib * 1.6 + roughness * 2)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>`).join('\n      ')}
    </mask>
  </defs>
  <g fill="currentColor" mask="url(#pen-__uid__)" filter="url(#ink-__uid__)">
    ${strokes.map((s) => `<path d="${s.outline}"/><circle cx="${f(s.cap.x)}" cy="${f(s.cap.y)}" r="${f(s.cap.w / 2)}"/>`).join('\n    ')}
  </g>
</svg>`);
}

// underline: one quick stroke that sags a touch and flicks up as the pen lifts
{
  rng = mulberry32(21);
  const wob = tremor(0.3);
  penSvg({
    file: 'underline.svg', width: 300, height: 22, seed: 4,
    strokes: [inkStroke({
      nib: 2.7,
      centre: (t) => [
        6 + 286 * t - 1.2 * (1 - smoothstep(0, 0.04, t)),
        11.5 + 1.8 * Math.sin(Math.PI * t) - 1.3 * (1 - smoothstep(0, 0.04, t)) - 4.2 * Math.pow(smoothstep(0.82, 1, t), 1.6) + wob(t),
      ],
      pressure: (t) => (0.55 + 0.45 * smoothstep(0, 0.1, t)) * (1 - 0.9 * smoothstep(0.6, 1, t)),
    })],
  });
}

// arrow: a shaft, then the head in one quick stroke
{
  rng = mulberry32(3);
  const wob = tremor(0.07);
  const head = [[29.5, 3.6], [37, 8.4], [30, 13.6]];
  penSvg({
    file: 'arrow.svg', width: 40, height: 17, seed: 3, roughness: 0.4,
    strokes: [
      inkStroke({
        nib: 1.45, samples: 60,
        centre: (t) => [2 + 34.5 * t, 9.4 - 1.6 * Math.sin(Math.PI * t) + 0.9 * t + wob(t)],
        pressure: (t) => (0.6 + 0.4 * smoothstep(0, 0.12, t)) * (1 - 0.55 * smoothstep(0.7, 1, t)),
      }),
      inkStroke({
        nib: 1.3, samples: 40,
        centre: (t) => {
          // two legs meeting at the tip, with a slightly rounded turn
          const [a, b, c] = head;
          const u = t * 2;
          return u < 1
            ? [lerp(a[0], b[0], u) - 0.6 * Math.sin(Math.PI * u), lerp(a[1], b[1], u)]
            : [lerp(b[0], c[0], u - 1), lerp(b[1], c[1], u - 1) + 0.5 * Math.sin(Math.PI * (u - 1))];
        },
        pressure: (t) => (0.65 + 0.35 * smoothstep(0, 0.2, t)) * (1 - 0.6 * smoothstep(0.75, 1, t)),
      }),
    ],
  });
}

// rule: a long, faintly wavering line for separators
{
  rng = mulberry32(11);
  const wob = tremor(0.45, [1.3, 3.1, 7.7]);
  penSvg({
    file: 'rule.svg', width: 860, height: 6, seed: 9, roughness: 0.5, attrs: 'preserveAspectRatio="none"',
    strokes: [inkStroke({
      nib: 1.05, samples: 220, contrast: 0,
      centre: (t) => [3 + 854 * t, 3 + wob(t)],
      pressure: (t) => (0.7 + 0.3 * smoothstep(0, 0.04, t)) * (1 - 0.6 * smoothstep(0.9, 1, t)) * (1 + 0.12 * Math.sin(t * 17)),
    })],
  });
}

// --- 4. Award ribbon ---------------------------------------------------------

// ribbon: a silk bookmark with a forked tail, in a watercolour wash
{
  rng = mulberry32(19);
  const wob = tremor(0.25, [0.9, 2.3]);
  const left = [], right = [];
  for (let i = 0; i <= 12; i++) {
    const y = (i / 12) * 38.5, sway = 0.7 * Math.sin((i / 12) * Math.PI * 0.9) + wob(i / 12);
    left.push([2 + sway, y]);
    right.push([14 + sway * 0.8, y]);
  }
  const lb = left[left.length - 1], rb = right[right.length - 1];
  const outline = smooth(left) + `L${f(lb[0] - 0.4)} ${f(45)}L${f(8.6)} ${f(38.6)}L${f(rb[0] + 0.3)} ${f(44.4)}` +
    `L${right.slice().reverse().map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
  write('ribbon.svg', `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 46">
  <defs>
    <filter id="wash-__uid__" x="-20%" y="-10%" width="140%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="4" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.55 1.18" result="pigment"/>
      <feComposite in="SourceGraphic" in2="pigment" operator="in" result="wash"/>
      <feDisplacementMap in="wash" in2="grain" scale="0.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <linearGradient id="shade-__uid__" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.28"/>
      <stop offset="0.12" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g filter="url(#wash-__uid__)">
    <path d="${outline}" fill="currentColor"/>
    <path d="${outline}" fill="url(#shade-__uid__)"/>
    <path d="${outline}" fill="none" stroke="currentColor" stroke-width="0.6" stroke-linejoin="round"/>
  </g>
</svg>`);
}

// --- 5. Favicon: a tiny neuron in rubric red ------------------------------
writeFileSync(new URL('../public/favicon.svg', import.meta.url), `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#a8412c" stroke-linecap="round">
  <path d="M16 18.5L16 3.5M16 9.5L11.5 5M16 7L20 3.5" stroke-width="2"/>
  <path d="M14 21L6.5 27M18 21L25.5 26.5M16 21.5L16.5 30M9.5 24.5L6 22.5M22 23.5L25 21" stroke-width="1.8"/>
  <path d="M16 12.5C18.4 15.5 20.4 18.6 19.6 20.6C18.6 22.2 13.4 22.2 12.4 20.6C11.6 18.6 13.6 15.5 16 12.5Z" fill="#a8412c" stroke="none"/>
</svg>
`.trim() + '\n');
console.log('wrote public/favicon.svg');
