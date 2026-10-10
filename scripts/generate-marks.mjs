// Generates the hand-drawn geometry in src/marks/: the neuron rules, rule and
// arrow. art/export.mjs reads these SVGs and prints them as risographs
// (art/riso.html), so the site shows the riso PNGs, not the SVGs themselves.
// Replace any file in src/marks/ with your own drawing (keep the filename) and
// re-run art/export.mjs.
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

// --- 1. Neuron rule: a horizontal divider (long for desktop, short for phones)
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

// --- 2. Pen marks ----------------------------------------------------------
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

