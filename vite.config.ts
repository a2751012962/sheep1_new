import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/sheep1_new/',  // 使用仓库名作为base
  plugins: [
    vue(),
    Unocss(),
  ],
})
