// Сборка: src/ -> www/ (код минимизируется и обфусцируется)
import { build } from 'esbuild';
import JO from 'javascript-obfuscator';
import fs from 'fs';

fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www');
fs.copyFileSync('src/index.html', 'www/index.html');
fs.copyFileSync('src/config.js', 'www/config.js');

await build({ entryPoints: ['src/native.js'], bundle: true, minify: true, format: 'iife', outfile: 'www/native.js', logLevel: 'warning' });

const min = await build({ entryPoints: ['src/app.js'], minify: true, format: 'iife', write: false, logLevel: 'warning' });
const code = min.outputFiles[0].text;
const out = JO.obfuscate(code, {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: true,
  stringArrayThreshold: 0.8,
  stringArrayEncoding: ['base64'],
  stringArrayWrappersCount: 2,
  controlFlowFlattening: false, // не замедляем склейку
  deadCodeInjection: false,
  selfDefending: false,
  target: 'browser',
}).getObfuscatedCode();
fs.writeFileSync('www/app.js', out);
console.log('app.js', code.length, '->', out.length);
