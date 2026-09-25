// Exportiert die prozeduralen Grundformen als eigenständige SVG-Dateien (assets/*.svg)
import fs from 'node:fs';
import { brainOutline, cerebellumOutline, brainstemOutline, brainGyri, makeNeuron, catmull, blobPts, C } from '../src/animation.js';
import { makeMicroglia } from '../src/scenes/shared.js';

const d = (pts, close = false) => 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') + (close ? ' Z' : '');
const svg = (vb, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">\n<rect x="-10000" y="-10000" width="20000" height="20000" fill="#050912"/>\n${body}\n</svg>\n`;

// Gehirn
let b = `<path d="${d(brainOutline, true)}" fill="#12224a" stroke="${C.neuron}" stroke-width="3"/>\n`;
b += `<path d="${d(brainstemOutline, true)}" fill="#0e1a38" stroke="${C.neuron}" stroke-width="2" opacity="0.7"/>\n`;
b += `<path d="${d(cerebellumOutline, true)}" fill="#12224a" stroke="${C.neuron}" stroke-width="2.5"/>\n`;
for (const g of brainGyri()) b += `<path d="${d(g.pts)}" fill="none" stroke="${C.neuron}" stroke-width="${g.w}" opacity="${g.major ? 0.5 : 0.25}"/>\n`;
fs.writeFileSync('assets/brain.svg', svg('-520 -430 1040 900', b));

// Neuron
const N = makeNeuron(5, { x: 0, y: 0, size: 1, dendrites: 6, axonAngle: 0.25, axonLen: 320, maxDepth: 3, spines: true });
let n = '';
for (const br of N.branches) n += `<path d="${d(br.pts)}" fill="none" stroke="${C.neuron}" stroke-linecap="round" stroke-width="${(br.w0 * 0.75).toFixed(1)}" opacity="${(0.95 - br.depth * 0.15).toFixed(2)}"/>\n`;
n += `<path d="${d(N.axon.pts)}" fill="none" stroke="${C.neuron}" stroke-width="2.4"/>\n`;
n += `<path d="${d(catmull(blobPts(0, 0, 16, 5, 0, 0.14, 12), 4, true), true)}" fill="${C.neuron}"/>\n`;
fs.writeFileSync('assets/neuron.svg', svg('-360 -300 720 600', n));

// Mikroglia
const M = makeMicroglia(9, { n: 9, size: 1 });
let m = '';
for (const p of M.procs) {
  const tx = Math.cos(p.ang) * p.len, ty = Math.sin(p.ang) * p.len;
  m += `<path d="M0,0 Q${(tx * 0.5 + 8).toFixed(1)},${(ty * 0.5 - 6).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}" fill="none" stroke="${C.mg}" stroke-width="7" stroke-linecap="round"/>\n`;
}
m += `<path d="${d(catmull(blobPts(0, 0, 30, 9, 0, 0.22, 14), 4, true), true)}" fill="${C.mg}"/>\n`;
fs.writeFileSync('assets/microglia.svg', svg('-200 -200 400 400', m));

// DNA
let dna = '';
const s1 = [], s2 = [];
for (let i = 0; i <= 120; i++) { const x = -300 + i * 5, th = i * 0.18; s1.push({ x, y: Math.sin(th) * 60 }); s2.push({ x, y: Math.sin(th + Math.PI) * 60 }); if (i % 4 === 2) dna += `<line x1="${x}" y1="${(Math.sin(th) * 60).toFixed(1)}" x2="${x}" y2="${(Math.sin(th + Math.PI) * 60).toFixed(1)}" stroke="#7fb2ff" stroke-width="2" opacity="0.6"/>\n`; }
dna += `<path d="${d(s1)}" fill="none" stroke="${C.gen}" stroke-width="5"/>\n<path d="${d(s2)}" fill="none" stroke="${C.gen}" stroke-width="5" opacity="0.7"/>\n`;
fs.writeFileSync('assets/dna.svg', svg('-320 -100 640 200', dna));

// Synapse
let sy = `<path d="${d(catmull(blobPts(0, -70, 60, 2, 0, 0.08, 12, 1.3), 4, true), true)}" fill="#23386d" stroke="#9fb6ff" stroke-width="3"/>\n`;
sy += `<path d="${d(catmull(blobPts(0, 75, 60, 7, 0, 0.08, 12, 1.3), 4, true), true)}" fill="#1d2c55" stroke="#9fb6ff" stroke-width="3"/>\n`;
for (const [x, y] of [[-30, -80], [10, -95], [35, -70], [-5, -55]]) sy += `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#b9c9ff" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3" fill="${C.glu}"/>\n`;
for (const x of [-40, -15, 10, 35]) sy += `<circle cx="${x}" cy="${-8 + (x % 3)}" r="3.5" fill="${C.glu}"/>\n`;
fs.writeFileSync('assets/synapse.svg', svg('-120 -160 240 320', sy));
console.log('SVG-Assets geschrieben: assets/brain.svg neuron.svg microglia.svg dna.svg synapse.svg');
