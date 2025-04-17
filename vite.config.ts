import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',  // 修改为相对路径
  plugins: [
    vue(),
    Unocss(),
  ],
})
