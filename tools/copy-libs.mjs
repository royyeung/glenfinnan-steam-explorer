// Copy runtime decoder libraries from three.js into public/ (Basis/KTX2 transcoder).
import fs from 'node:fs';
const src = 'node_modules/three/examples/jsm/libs/basis', dst = 'public/basis';
fs.mkdirSync(dst, { recursive: true });
for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) fs.copyFileSync(`${src}/${f}`, `${dst}/${f}`);
console.log('copied basis transcoder ->', dst);
