import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/nodemailer.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'node22',
  platform: 'neutral',
});
