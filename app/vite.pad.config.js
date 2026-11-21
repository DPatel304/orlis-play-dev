/* The pad page (plan package P3): its own small entry, built to dist-pad/ and served by the pad hub at "/".
   Build it with `npm run build:pad`. Relative base, so it works from any host and port. */
import { fileURLToPath } from 'node:url';
export default {
  root: fileURLToPath(new URL('./pad', import.meta.url)),
  base: './',
  publicDir: false,
  build: { outDir: fileURLToPath(new URL('./dist-pad', import.meta.url)), emptyOutDir: true, target: 'es2020', assetsInlineLimit: 0 }
};
