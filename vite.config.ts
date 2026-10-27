import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 使用相對路徑，讓 GitHub Pages 專案頁（/repo-name/）與自訂網域都能直接運作
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
