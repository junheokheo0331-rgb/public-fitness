import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // GitHub Pages 프로젝트 사이트는 https://<계정>.github.io/<레포이름>/ 아래에 놓인다.
  // 이 값이 '/' 로 남아 있으면 CSS·JS 를 루트에서 찾다가 전부 404 가 난다.
  // 워크플로가 VITE_BASE=/<레포이름>/ 을 넣어준다. 로컬에서는 그냥 '/'.
  base: process.env.VITE_BASE || '/',

  server: { port: 5173 },
  // tesseract.js 는 무겁다. 체성분 화면에 들어갈 때만 받도록 분리한다.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('tesseract')) return 'ocr';
        },
      },
    },
  },
});
