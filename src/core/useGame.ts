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
    const selectedIds = new Set(selectedNodes.value.map(node => node.id));

    nodes.value.forEach((o) => {
      // IMPORTANT: Only update state if the card is NOT currently in the hand (state 2)
      if (!selectedIds.has(o.id)) {
         // If not in hand, determine state based on parents
         o.state = o.parents.every(p => p.state > 0) ? 1 : 0
      } 
      // else: If it IS in the hand (selectedIds.has(o.id)), do nothing - preserve its state (which should be 2)
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
      setTimeout(() => {
        for (let i = 0; i < 3; i++) {
          selectedNodes.value.splice(secondIndex - 1, 1)
        }
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
    console.log("Hand cards BEFORE shuffle:", JSON.parse(JSON.stringify(selectedNodes.value.map(n => ({ id: n.id, type: n.type })))));

    // --- Gather cards for shuffling (excluding hand) --- 
    const availableNodes = nodes.value.filter(node => [0, 1].includes(node.state));
    // const handNodes = selectedNodes.value; // Explicitly EXCLUDE hand nodes
    const removedNodes = removeList.value;
    
    // Combine cards whose types will be shuffled together (available + removed)
    const cardsToShuffleType = [
      ...availableNodes, 
      // ...handNodes, // DO NOT INCLUDE HAND NODES
      ...removedNodes
    ];

    if (cardsToShuffleType.length < 2) {
      console.log("Not enough other cards to shuffle.");
      console.log("--- Shuffle End (No Action) ---");
      // Nothing to shuffle if less than 2 cards involved (excluding hand)
      return; 
    }

    // --- Shuffle types for available & removed cards --- 
    const typesToShuffle = cardsToShuffleType.map(card => card.type);
    const shuffledTypes = shuffle([...typesToShuffle]);

    // --- Redistribute shuffled types ONLY to available & removed cards --- 
    cardsToShuffleType.forEach((card, index) => {
      card.type = shuffledTypes[index];
    });

    // --- Separately handle position shuffle for MAIN AREA cards (subset of availableNodes) ---
    // Note: Main area cards already got their new types from the step above
    const mainAreaCards = availableNodes.filter(node => !node.id.startsWith('stack-'))
    if (mainAreaCards.length > 0) {
      // Record original positions
      const originalPositions = mainAreaCards.map(card => ({
        top: card.top, left: card.left, zIndex: card.zIndex,
        row: card.row, column: card.column
      }));
      const shuffledPositions = shuffle([...originalPositions]);

      // Assign new positions
      mainAreaCards.forEach((card, index) => {
        const newPos = shuffledPositions[index];
        card.top = newPos.top; card.left = newPos.left; card.zIndex = newPos.zIndex;
        card.row = newPos.row; card.column = newPos.column;
      });

      // Update parent relationships for main area cards
      mainAreaCards.forEach(card => { card.parents = [] })
      mainAreaCards.forEach((card, i) => {
        mainAreaCards.forEach((otherCard, j) => {
          if (i !== j) {
            if (Math.abs(card.top - otherCard.top) <= size &&
                Math.abs(card.left - otherCard.left) <= size &&
                card.zIndex > otherCard.zIndex) {
              otherCard.parents.push(card)
            }
          }
        })
      })
      
      // Update states for all available nodes (State 0/1) based on new parent relationships
      updateState()
    } 
    else if (availableNodes.length > 0 && mainAreaCards.length === 0) {
        // If only stack cards were shuffled (type only), still call updateState
        updateState();
    }

    // Hand nodes (selectedNodes) were explicitly excluded and remain unchanged.
    console.log("Hand cards AFTER shuffle logic:", JSON.parse(JSON.stringify(selectedNodes.value.map(n => ({ id: n.id, type: n.type })))));
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
