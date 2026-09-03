import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 상대 경로로 어디서든 유연하게 동작
  server: {
    port: 3000,
    open: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
