import { build } from 'esbuild';

// Bundle the installed Identity SDK locally; no external script host is required.
await build({
  entryPoints: ['src/admin.js'],
  outfile: 'public/admin.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
});
