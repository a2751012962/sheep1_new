<script setup lang="ts">
import { ref } from 'vue'
import type { CardNode } from '../types/type'

const props = defineProps<{
  nodes: CardNode[]
  onAIMove: (node: CardNode) => void
}>()

const isThinking = ref(false)
const error = ref('')

const API_URL = 'http://localhost:5000'

async function getAIMove() {
  isThinking.value = true
  error.value = ''
  
  try {
    console.log('Sending request to AI server...')
    const response = await fetch(`${API_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gameState: {
          nodes: props.nodes.map(node => ({
            id: node.id,
            type: node.type,
            x: node.x,
            y: node.y,
            z: node.z,
            canClick: node.canClick,
            isRemoved: node.isRemoved,
            isSelected: node.isSelected
          }))
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `AI 服务器响应错误: ${response.status}`)
    }

    const data = await response.json()
    console.log('AI response:', data)

    if (data.error) {
      throw new Error(data.error)
    }

    const suggestedNode = props.nodes.find(node => 
      node.canClick && !node.isRemoved && node.id === data.action.data.node.id
    )

    if (suggestedNode) {
      props.onAIMove(suggestedNode)
    } else {
      throw new Error('无法找到可点击的卡片')
    }
  } catch (e) {
    console.error('AI error:', e)
    error.value = e instanceof Error ? e.message : '未知错误'
  } finally {
    isThinking.value = false
  }
}
</script>

<template>
  <div class="ai-helper">
    <button 
      :disabled="isThinking" 
      @click="getAIMove"
      class="ai-button"
    >
      {{ isThinking ? '思考中...' : 'AI 提示' }}
    </button>
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.ai-helper {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 10px 0;
}

.ai-button {
  background-color: #4CAF50;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.ai-button:hover:not(:disabled) {
  background-color: #45a049;
}

.ai-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #ff4444;
  margin-top: 8px;
  font-size: 12px;
}
</style> 