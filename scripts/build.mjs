import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectDirectory, 'dist');

if (dirname(outputDirectory) !== projectDirectory) {
  throw new Error('Build output must stay inside the project directory.');
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const entry of ['index.html', 'app.js', 'styles.css', 'admin', 'dashboard', 'src']) {
  await cp(join(projectDirectory, entry), join(outputDirectory, entry), { recursive: true });
}

console.log('Static storefront built in dist/.');
