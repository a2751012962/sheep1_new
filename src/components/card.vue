<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<Props>()
const emit = defineEmits(['clickCard'])

// 加载图片资源
const modules = import.meta.glob('../assets/custom_cards/*.png', {
  as: 'url',
  import: 'default',
  eager: true,
})

// 创建1-18的映射关系
const IMG_MAP = Object.keys(modules).reduce((acc, cur) => {
  const key = cur.replace('../assets/custom_cards/', '').replace('.png', '')
  // 将原始编号映射到1-18的范围
  const numKey = parseInt(key)
  acc[numKey] = modules[cur]
  return acc
}, {} as Record<string, string>)

interface Props {
  node: CardNode
  isDock?: boolean
}
const isFreeze = computed(() => {
  return props.node.parents.length > 0 ? props.node.parents.some(o => o.state < 2) : false
},
)

function handleClick() {
  if (!isFreeze.value)
    emit('clickCard', props.node)
}
</script>

<template>
  <div
    class="card"
    :style="isDock ? {} : { position: 'absolute', zIndex: node.zIndex, top: `${node.top}px`, left: `${node.left}px` }"
    @click="handleClick"
  >
    <!-- {{ node.zIndex }}-{{ node.type }} -->
    <!-- {{ node.id }} -->
    <img :src="IMG_MAP[node.type]" width="40" height="40" :alt="`${node.type}`">
    <div v-if="isFreeze" class="mask" />
  </div>
</template>

<style scoped>
.card{
  width: 40px;
  height: 40px;
  background: #ffffff;
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: 8px;
  border: 2px solid #e1e1e1;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 6px 6px 18px rgba(0,0,0,0.15),
             -6px -6px 18px rgba(255,255,255,0.9);
}

img{
  border-radius: 6px;
  width: 35px;
  height: 35px;
  object-fit: cover;
}

.mask {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  background-color: rgba(255, 255, 255, 0.6);
  width: 100%;
  height: 100%;
  border-radius: 8px;
  pointer-events: none;
}
</style>
