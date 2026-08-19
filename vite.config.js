import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/CDN-Config-Generator/',
  plugins: [vue()],
  // Explicit, so a new directory of tests cannot be quietly left uncollected.
  test: { include: ['src/**/*.test.js'] },
})
