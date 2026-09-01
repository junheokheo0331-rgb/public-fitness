import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const candidates = ['.env.local', '.env'];
const envFile = candidates.map((name) => path.join(root, name)).find((file) => fs.existsSync(file));
const contents = envFile ? fs.readFileSync(envFile, 'utf8') : '';
const match = contents.match(/^VITE_KAKAO_MAP_KEY\s*=\s*['"]?([^'"\r\n]*)/m);
const key = match?.[1]?.trim() || process.env.VITE_KAKAO_MAP_KEY?.trim() || '';

console.log('GymLink Kakao Map configuration');
console.log(`- Environment file: ${envFile ? path.basename(envFile) : 'not found'}`);
console.log(`- JavaScript key: ${key ? 'configured' : 'missing'}`);
console.log('- SDK: maps + services + autoload=false');
console.log('- Local domains: http://localhost:5173, http://127.0.0.1:4173');
console.log('- Production domain: add the final Vercel domain after the first deployment');

if (!key) {
  console.error('\nVITE_KAKAO_MAP_KEY에 카카오 REST 키가 아닌 JavaScript 키를 넣어주세요.');
  process.exitCode = 1;
}
