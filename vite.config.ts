import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相对路径，保证部署到 GitHub Pages 子目录也能正常加载资源
  base: './',
})
