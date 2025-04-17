import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/sheep1_new/',  // 确保这个值与仓库名称匹配
  plugins: [
    vue(),
    Unocss(),
  ],
})
