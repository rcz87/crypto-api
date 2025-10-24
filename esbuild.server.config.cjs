const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['server/index.ts'],
  platform: 'node',
  target: ['node20'],
  bundle: true,
  format: 'cjs',                     // ✅ FORCE CommonJS
  outfile: 'dist/index.cjs',         // ✅ Output only 1 file (CJS)
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  external: [
    'vite', '@vitejs/plugin-react', '@replit/vite-plugin-runtime-error-modal',
    '@replit/vite-plugin-cartographer', 'express', 'path', 'fs', 'body-parser',
    'http', 'https', 'zlib', 'stream', 'events', 'module', 'better-sqlite3', 'bcrypt'
  ],
  logLevel: 'info'
});
