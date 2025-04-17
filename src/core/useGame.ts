import { ref, Ref } from 'vue'
import { ceil, floor, random, shuffle } from 'lodash-es'

// 更新 Game 接口定义，添加新的属性
interface Game {
  nodes: Ref<CardNode[]>
  selectedNodes: Ref<CardNode[]>
  removeFlag: Ref<boolean>
  removeList: Ref<CardNode[]>
  backFlag: Ref<boolean>
  handleSelect: (node: CardNode) => void
  handleBack: () => void
  handleRemove: () => void
  handleSelectRemove: (node: CardNode) => void
  handleShuffle: () => void  // 添加洗牌方法
  initData: (config?: GameConfig | null) => void
  backCount: Ref<number>      // 当前撤销次数
  removeCount: Ref<number>    // 当前移除次数
  maxBackCount: number        // 最大撤销次数限制
  maxRemoveCount: number      // 最大移除次数限制
}

const defaultGameConfig: GameConfig = {
  cardNum: 4,
  layerNum: 2,
  trap: true,
  delNode: false,
}

export function useGame(config: GameConfig): Game {
  const { container, delNode, events = {}, ...initConfig } = { ...defaultGameConfig, ...config }
  const histroyList = ref<CardNode[]>([])
  const backFlag = ref(false)
  const removeFlag = ref(false)
  const removeList = ref<CardNode[]>([])  // 当前显示的移出区域牌组
  const removedSets = ref<CardNode[][]>([])  // 存储所有已移出的牌组
  const preNode = ref<CardNode | null>(null)
  const nodes = ref<CardNode[]>([])
  const indexSet = new Set()
  let perFloorNodes: CardNode[] = []
  const selectedNodes = ref<CardNode[]>([])
  const size = 40
  let floorList: number[][] = []
  
  // 添加撤销和移除次数的计数器
  const backCount = ref(0)
  const removeCount = ref(0)
  const maxBackCount = 1  // 最大撤销次数
  const maxRemoveCount = 2  // 最大移除次数

  function updateState() {
    // Create a Set of IDs currently in the hand for efficient lookup
    // const selectedIds = new Set(selectedNodes.value.map(node => node.id)); // 不再需要 selectedIds

    nodes.value.forEach((o) => {
      // --- 开始修改 ---
      // 只更新状态为 0 (覆盖) 或 1 (可点击) 的牌
      // 跳过状态为 2 (手牌区) 或 3 (已消除) 的牌
      if (o.state === 0 || o.state === 1) {
         // 基于父牌状态决定当前牌是 0 (覆盖) 还是 1 (可点击)
         // 如果所有父牌都已移除 (state > 1)，则当前牌可点击 (state = 1)
         o.state = o.parents.every(p => p.state > 1) ? 1 : 0;
      }
      // 对于 state 2 和 3 的牌，保持它们的状态不变
      // --- 结束修改 ---
    })
  }

  function handleSelect(node: CardNode) {
    if (selectedNodes.value.length === 7)
      return
    node.state = 2
    histroyList.value.push(node)
    preNode.value = node
    const index = nodes.value.findIndex(o => o.id === node.id)
    if (index > -1)
      delNode && nodes.value.splice(index, 1)

    const selectedSomeNode = selectedNodes.value.filter(s => s.type === node.type)
    if (selectedSomeNode.length === 2) {
      const secondIndex = selectedNodes.value.findIndex(o => o.id === selectedSomeNode[1].id)
      selectedNodes.value.splice(secondIndex + 1, 0, node)

      // 获取即将被消除的 3 张牌的 ID
      const eliminatedIds = [
          selectedNodes.value[secondIndex - 1].id, // 第一张
          selectedNodes.value[secondIndex].id,     // 第二张 (刚插入的 node 的前一张)
          node.id                                // 第三张 (刚插入的 node)
      ];

      setTimeout(() => {
        // 从手牌区移除
        selectedNodes.value.splice(secondIndex - 1, 3)

        // 在主列表中标记为已消除 (state = 3)
        nodes.value.forEach(n => {
          if (eliminatedIds.includes(n.id)) {
            n.state = 3; // 标记为已消除
          }
        });

        preNode.value = null
        if (delNode ? nodes.value.length === 0 : nodes.value.every(o => o.state > 0) && removeList.value.length === 0 && selectedNodes.value.length === 0) {
          removeFlag.value = true
          backFlag.value = true
          events.winCallback && events.winCallback()
        }
        else {
          events.dropCallback && events.dropCallback()
        }
      }, 100)
    }
    else {
      events.clickCallback && events.clickCallback()
      const index = selectedNodes.value.findIndex(o => o.type === node.type)
      if (index > -1)
        selectedNodes.value.splice(index + 1, 0, node)
      else
        selectedNodes.value.push(node)
      
      // 更新按钮状态
      removeFlag.value = !(selectedNodes.value.length >= 3 && removeCount.value < maxRemoveCount)
      backFlag.value = !(preNode.value && backCount.value < maxBackCount)

      if (selectedNodes.value.length === 7) {
        removeFlag.value = true
        backFlag.value = true
        events.loseCallback && events.loseCallback()
      }
    }
  }

  function handleSelectRemove(node: CardNode) {
    // node is the card clicked in the removeList (e.g., B1)
    // Ensure necessary properties exist
    if (node.setIndex === undefined || node.positionInSet === undefined) {
        console.error("Clicked card in removeList lacks setIndex or positionInSet:", node);
        return;
    }

    const currentSetIndex = node.setIndex;
    const currentPosition = node.positionInSet;

    // Find the index of the clicked node in the currently displayed list
    const displayIndex = removeList.value.findIndex(o => o.id === node.id);
    if (displayIndex === -1) {
        console.error("Clicked card not found in removeList:", node);
        return; // Card not found in the display list, should not happen
    }

    // Temporarily remove the clicked node (B1) from the display list
    removeList.value.splice(displayIndex, 1);

    // Find the corresponding card from the previous set in history (e.g., A1)
    const prevSetIndex = currentSetIndex - 1;
    if (prevSetIndex >= 0) {
        const prevSet = removedSets.value[prevSetIndex];
        // Check if the previous set and the card at the specific position exist
        if (prevSet && prevSet[currentPosition]) {
            const cardFromHistory = prevSet[currentPosition];

            // Create a completely new object to ensure reactivity updates
            // This new object represents the card being restored (A1)
            const cardToDisplay = {
                ...cardFromHistory, // Copy all properties from the historical card
                setIndex: prevSetIndex, // Assign the correct historical set index
                positionInSet: currentPosition, // Maintain the correct position within the set
                state: 1 // *** CRITICAL: Ensure the restored card is clickable ***
            };

            // Insert the restored card (A1) into the display list at the correct logical position
            // Use currentPosition (0, 1, or 2) for insertion index
            removeList.value.splice(currentPosition, 0, cardToDisplay);
        } else {
             console.warn(`No card found in previous set (index ${prevSetIndex}) at position ${currentPosition}`);
        }
    } else {
        // This was the first set removed, so the slot remains empty after removing 'node'
    }

    // Now, process the card that was originally clicked (node = B1)
    // Pass the original 'node' object to handleSelect.
    // handleSelect will set its state to 2 (selected) and move it.
    // No need to set state: 1 here as handleSelect handles its state.
    handleSelect(node);
  }

  function handleBack() {
    if (backCount.value >= maxBackCount) {
      return
    }

    const node = preNode.value
    if (!node)
      return
    
    backCount.value++
    preNode.value = null
    backFlag.value = true  // 使用后禁用
    node.state = 0
    delNode && nodes.value.push(node)
    const index = selectedNodes.value.findIndex(o => o.id === node.id)
    selectedNodes.value.splice(index, 1)
  }

  function handleRemove() {
    if (removeCount.value >= maxRemoveCount || selectedNodes.value.length < 3) {
      return
    }

    removeCount.value++
    removeFlag.value = !(selectedNodes.value.length >= 3 && removeCount.value < maxRemoveCount)
    // We don't reset preNode here as it relates to 'handleBack' functionality

    const currentSetIndex = removedSets.value.length;
    const newSet: CardNode[] = [] // This will hold cards for historical record
    const displaySet: CardNode[] = [] // This will hold cards for the reactive removeList

    for (let i = 0; i < 3; i++) {
      const nodeFromSelection = selectedNodes.value.shift() // Get card from selection tray
      if (!nodeFromSelection) break

      // Create a new object for the historical set (removedSets)
      const nodeForHistory = {
        ...nodeFromSelection, // Copy properties
        setIndex: currentSetIndex,
        positionInSet: i,
        state: 1 // Ensure state is 1 for storage
      }
      newSet.push(nodeForHistory);

      // Create another distinct new object for the display list (removeList)
      // This ensures removeList gets fresh objects, potentially helping reactivity
       const nodeForDisplay = {
        ...nodeForHistory // Copy from the already processed history node
      };
      displaySet.push(nodeForDisplay);

      // Optional: Reset state of the original node in selectedNodes if needed?
      // nodeFromSelection.state = 0; // Or some other state? - Let's avoid this for now.
    }

    // Store the historical set
    if (newSet.length > 0) {
       removedSets.value.push(newSet);
    }

    // Update the reactive display list with completely new objects
    if (displaySet.length > 0) {
        removeList.value = displaySet; // Assign the array of new objects
    } else {
        removeList.value = []; // Clear list if no nodes were removed
    }

     // Update button states based on the new counts and list lengths
     removeFlag.value = !(selectedNodes.value.length >= 3 && removeCount.value < maxRemoveCount);
     // backFlag logic depends on preNode, which wasn't changed here.
  }

  function handleShuffle() {
    console.log("--- Shuffle Start ---");

    // 1. 识别洗牌候选卡牌 (排除手牌, 移出区)
    const handIds = new Set(selectedNodes.value.map(n => n.id));
    const removeIds = new Set(removeList.value.map(n => n.id));

    const shuffleCandidates = nodes.value.filter(node =>
      !handIds.has(node.id) &&             // 不在手牌区
      !removeIds.has(node.id) &&          // 不在移出区 (当前显示的)
      (node.state === 0 || node.state === 1)  // 在场上 (被覆盖或可点击)
    );

    if (shuffleCandidates.length <= 1) {
      console.log("Not enough cards to shuffle.");
      return; // 不需要洗牌
    }

    console.log(`Shuffling ${shuffleCandidates.length} cards.`);

    // 2. 提取这些卡牌的当前位置信息
    const positions = shuffleCandidates.map(node => ({
      top: node.top,
      left: node.left,
      zIndex: node.zIndex,
      // 保留 row/column 也许有用，但暂时不洗牌它们
    }));

    // 3. 洗牌位置信息 (只洗 top, left, zIndex)
    const shuffledPositions = shuffle(positions);

    // 4. 将洗牌后的位置重新分配给候选卡牌
    shuffleCandidates.forEach((node, index) => {
      node.top = shuffledPositions[index].top;
      node.left = shuffledPositions[index].left;
      node.zIndex = shuffledPositions[index].zIndex;
    });

    // 5. 重新计算所有卡牌的父子关系
    console.log("Recalculating parent relationships...");
    nodes.value.forEach(node => { node.parents = [] }); // 清空所有父关系

    const cardSize = size; // 使用已定义的 size 变量

    // O(n^2) 检查，对于几百张牌可以接受
    nodes.value.forEach((potentialChild) => {
      // 跳过已在手牌区的牌，它们不应再有父牌
      if (handIds.has(potentialChild.id)) return;

      nodes.value.forEach((potentialParent) => {
        // 跳过检查自身，或检查已在手牌区的牌作为父牌
        if (potentialChild.id === potentialParent.id || handIds.has(potentialParent.id)) return;

        // 检查重叠和 Z 轴关系 (potentialParent 在 potentialChild 上方)
        if (
          Math.abs(potentialParent.top - potentialChild.top) < cardSize &&
          Math.abs(potentialParent.left - potentialChild.left) < cardSize &&
          potentialParent.zIndex > potentialChild.zIndex // 父牌 zIndex 更大 (更靠上)
        ) {
          potentialChild.parents.push(potentialParent);
        }
      });
    });
    console.log("Parent relationships recalculated.");

    // 6. 基于新的父子关系更新卡牌状态 (哪些变成可点击)
    updateState();

    console.log("--- Shuffle End ---");
  }

  function initData(config?: GameConfig | null) {
    const { cardNum, layerNum, trap } = { ...initConfig, ...config }
    histroyList.value = []
    backFlag.value = true  // 初始时禁用
    removeFlag.value = true  // 初始时禁用
    removeList.value = []
    removedSets.value = []  // 重置所有移出的牌组
    preNode.value = null
    nodes.value = []
    indexSet.clear()
    perFloorNodes = []
    selectedNodes.value = []
    floorList = []
    backCount.value = 0
    removeCount.value = 0

    const isTrap = trap && floor(random(0, 100)) !== 50

    const itemTypes = (new Array(cardNum).fill(0)).map((_, index) => index + 1)
    let itemList: number[] = []
    for (let i = 0; i < 15; i++) {
      itemList = [...itemList, ...itemTypes]
    }
    itemList = shuffle(shuffle(itemList))

    const centerCards = itemList.slice(0, 240)
    const leftStackCards = itemList.slice(240, 255)
    const rightStackCards = itemList.slice(255, 270)

    let len = 0
    let floorIndex = 1
    const itemLength = centerCards.length
    while (len <= itemLength) {
      const maxFloorNum = floorIndex * floorIndex
      const floorNum = ceil(random(maxFloorNum / 2, maxFloorNum))
      floorList.push(centerCards.splice(0, floorNum))
      len += floorNum
      floorIndex++
    }

    const containerWidth = container.value!.clientWidth
    const containerHeight = container.value!.clientHeight
    const width = containerWidth / 2
    const height = containerHeight / 2 + 100

    const stackSize = 15
    const stackSpacing = 2
    
    for (let i = 0; i < stackSize; i++) {
      const node: CardNode = {
        id: `stack-left-${i}`,
        type: leftStackCards[i],
        zIndex: i,
        index: i,
        row: 0,
        column: 0,
        top: height,
        left: 50 + (i * stackSpacing),
        parents: [],
        state: 1,
      }
      nodes.value.push(node)
    }

    for (let i = 0; i < stackSize; i++) {
      const node: CardNode = {
        id: `stack-right-${i}`,
        type: rightStackCards[i],
        zIndex: i,
        index: i,
        row: 0,
        column: 0,
        top: height,
        left: containerWidth - 90 + (i * stackSpacing),
        parents: [],
        state: 1,
      }
      nodes.value.push(node)
    }

    floorList.forEach((o, index) => {
      indexSet.clear()
      let i = 0
      const floorNodes: CardNode[] = []
      o.forEach((k) => {
        i = floor(random(0, (index + 1) ** 2))
        while (indexSet.has(i))
          i = floor(random(0, (index + 1) ** 2))
        const row = floor(i / (index + 1))
        const column = index ? i % index : 0
        const node: CardNode = {
          id: `${index}-${i}`,
          type: k,
          zIndex: index,
          index: i,
          row,
          column,
          top: height + (size * row - (size / 2) * index),
          left: width + (size * column - (size / 2) * index),
          parents: [],
          state: 0,
        }
        const xy = [node.top, node.left]
        perFloorNodes.forEach((e) => {
          if (Math.abs(e.top - xy[0]) <= size && Math.abs(e.left - xy[1]) <= size)
            e.parents.push(node)
        })
        floorNodes.push(node)
        indexSet.add(i)
      })
      nodes.value = nodes.value.concat(floorNodes)
      perFloorNodes = floorNodes
    })

    // --- 开始添加: 计算库存牌的父子关系 ---
    console.log("Calculating parent relationships for stacks...");
    const leftStack = nodes.value.filter(n => n.id.startsWith('stack-left-')).sort((a, b) => a.zIndex - b.zIndex);
    const rightStack = nodes.value.filter(n => n.id.startsWith('stack-right-')).sort((a, b) => a.zIndex - b.zIndex);

    [leftStack, rightStack].forEach(stack => {
      for (let i = 0; i < stack.length - 1; i++) {
        const child = stack[i];
        const parent = stack[i + 1]; // 叠在它上面的那张牌
        if (parent) {
           child.parents.push(parent);
        }
      }
      // 最顶部的牌 (stack[stack.length - 1]) 会自然地没有父牌
    });
    console.log("Stack parent relationships calculated.");
    // --- 结束添加 ---

    updateState()
  }

  return {
    nodes,
    selectedNodes,
    removeFlag,
    removeList,
    backFlag,
    handleSelect,
    handleBack,
    handleRemove,
    handleSelectRemove,
    handleShuffle,
    initData,
    backCount,
    removeCount,
    maxBackCount,
    maxRemoveCount,
  }
}
