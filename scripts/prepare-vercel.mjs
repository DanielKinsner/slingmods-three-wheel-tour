import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const output = resolve(root, '.vercel/output');
await access(join(dist, 'index.html'));
// Remove only this project's generated deployment output, never its account link.
if (relative(root, output) !== join('.vercel', 'output')) throw new Error('Invalid output path');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(dist, join(output, 'static'), { recursive: true });
await writeFile(
  join(output, 'config.json'),
  JSON.stringify({
    version: 3,
    routes: [
      {
        src: '/assets/(.*)',
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
        continue: true,
      },
      {
        src: '/(index.html)?',
        headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
        continue: true,
      },
      {
        src: '/textures/(.*)',
        headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
        continue: true,
      },
      { handle: 'filesystem' },
    ],
  }, null, 2) + '\n',
);
console.log('Prepared the existing dist/ files in .vercel/output/static.');
