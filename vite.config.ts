import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/sheep1_new/',  // 替换为你的仓库名
  plugins: [
    vue(),
    Unocss(),
  ],
})
