// Renders the social-share card: scripts/og.svg → static/og.png (1200×630).
// Run with: npm run og
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'og.svg');
const out = join(here, '..', 'static', 'og.png');

await sharp(src, { density: 144 })
	.resize(1200, 630)
	.png({ quality: 95 })
	.toFile(out);

console.log(`rendered ${out}`);
