import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import random

@dataclass
class CardNode:
    """Represents a card in the game"""
    id: str
    type: int  # Card type (1-18)
    z_index: int  # Layer depth
    index: int  # Position index
    row: int  # Row in grid
    column: int  # Column in grid
    top: float  # Y position
    left: float  # X position
    state: int  # 0: covered, 1: clickable, 2: selected, 3: eliminated
    parents: List['CardNode']  # Cards covering this one

class SheepGame:
    """
    SheepGame is the core game wrapper that exposes state and action interfaces
    for reinforcement learning agents.
    
    Game Rules:
    - Total of 270 cards (15 cards each of 18 types)
    - 240 cards in middle area, 15 cards in left stack, 15 in right stack
    - Cards can be clicked if not covered by other cards
    - Three matching cards can be eliminated
    - Two special actions: undo (max 1) and remove (max 2)
    """

    def __init__(self, card_types: int = 18, container_size: Tuple[int, int] = (800, 600)):
        """
        Initialize game parameters
        Args:
            card_types: Number of different card types (default 18)
            container_size: (width, height) of game area
        """
        self.card_types = card_types
        self.container_width, self.container_height = container_size
        self.card_size = 40  # Size of each card
        self.max_back_count = 1  # Maximum number of undo actions
        self.max_remove_count = 2  # Maximum number of remove actions
        self.reset()

    def reset(self) -> Dict:
        """Initialize a new game state"""
        # Reset game state
        self.nodes: List[CardNode] = []
        self.selected_nodes: List[CardNode] = []
        self.remove_list: List[CardNode] = []
        self.removed_sets: List[List[CardNode]] = []
        self.back_count = 0
        self.remove_count = 0
        self.done = False
        
        # Initialize cards
        self._init_cards()
        
        # Update initial state
        self._update_state()
        
        return self.get_state()

    def _init_cards(self):
        """Initialize card distribution"""
        # Generate card types (15 of each type)
        item_types = list(range(1, self.card_types + 1))
        item_list = []
        for _ in range(15):
            item_list.extend(item_types)
        random.shuffle(item_list)
        
        # Split cards for different areas
        center_cards = item_list[:240]
        left_stack = item_list[240:255]
        right_stack = item_list[255:270]
        
        # Initialize stacks
        self._init_stacks(left_stack, right_stack)
        
        # Initialize center area
        self._init_center_area(center_cards)

    def _init_stacks(self, left_stack: List[int], right_stack: List[int]):
        """Initialize left and right card stacks"""
        stack_size = 15
        stack_spacing = 2
        
        # Left stack
        for i in range(stack_size):
            node = CardNode(
                id=f"stack-left-{i}",
                type=left_stack[i],
                z_index=i,
                index=i,
                row=0,
                column=0,
                top=self.container_height/2 + 100,
                left=50 + (i * stack_spacing),
                state=1,
                parents=[]
            )
            self.nodes.append(node)
            
        # Right stack
        for i in range(stack_size):
            node = CardNode(
                id=f"stack-right-{i}",
                type=right_stack[i],
                z_index=i,
                index=i,
                row=0,
                column=0,
                top=self.container_height/2 + 100,
                left=self.container_width - 90 + (i * stack_spacing),
                state=1,
                parents=[]
            )
            self.nodes.append(node)

    def _init_center_area(self, center_cards: List[int]):
        """Initialize center area with layered cards"""
        width = self.container_width / 2
        height = self.container_height / 2 + 100
        
        floor_list = []
        cards_left = center_cards.copy()
        floor_index = 1
        
        while cards_left:
            max_floor_num = floor_index * floor_index
            floor_num = random.randint(max_floor_num // 2, max_floor_num)
            if floor_num > len(cards_left):
                floor_num = len(cards_left)
            floor_cards = cards_left[:floor_num]
            floor_list.append(floor_cards)
            cards_left = cards_left[floor_num:]
            floor_index += 1
            
        per_floor_nodes = []
        for floor_idx, floor_cards in enumerate(floor_list):
            floor_nodes = []
            used_indices = set()
            
            for card in floor_cards:
                # Find valid position
                while True:
                    i = random.randint(0, (floor_idx + 1) ** 2 - 1)
                    if i not in used_indices:
                        break
                        
                row = i // (floor_idx + 1)
                column = i % (floor_idx + 1) if floor_idx else 0
                
                node = CardNode(
                    id=f"{floor_idx}-{i}",
                    type=card,
                    z_index=floor_idx,
                    index=i,
                    row=row,
                    column=column,
                    top=height + (self.card_size * row - (self.card_size/2) * floor_idx),
                    left=width + (self.card_size * column - (self.card_size/2) * floor_idx),
                    state=0,
                    parents=[]
                )
                
                # Set parent relationships
                for prev_node in per_floor_nodes:
                    if (abs(prev_node.top - node.top) <= self.card_size and 
                        abs(prev_node.left - node.left) <= self.card_size):
                        prev_node.parents.append(node)
                
                floor_nodes.append(node)
                used_indices.add(i)
            
            self.nodes.extend(floor_nodes)
            per_floor_nodes = floor_nodes

    def _update_state(self):
        """Update card states based on parent relationships"""
        for node in self.nodes:
            if node.state in [0, 1]:  # Only update covered or clickable cards
                # Card is clickable if all parents are eliminated
                node.state = 1 if all(p.state > 1 for p in node.parents) else 0

    def step(self, action: int) -> Tuple[float, bool]:
        """
        Apply an action and return reward and done status
        Args:
            action: Index of card to select (0 to len(nodes)-1)
        Returns:
            reward (float), done (bool)
        """
        if action < 0 or action >= len(self.nodes):
            return -1.0, self.done
            
        node = self.nodes[action]
        if node.state != 1:  # Card must be clickable
            return -0.5, self.done
            
        reward = self._handle_select(node)
        self._update_state()
        
        # Check win/lose conditions
        if all(n.state > 1 for n in self.nodes):
            reward += 10.0  # Win bonus
            self.done = True
        elif len(self.selected_nodes) >= 7:
            reward -= 5.0  # Lose penalty
            self.done = True
            
        return reward, self.done

    def _handle_select(self, node: CardNode) -> float:
        """Handle card selection and return reward"""
        if len(self.selected_nodes) >= 7:
            return -0.1
            
        node.state = 2  # Mark as selected
        reward = 0.1  # Small reward for valid selection
        
        # Find matching cards
        matching_cards = [n for n in self.selected_nodes if n.type == node.type]
        if len(matching_cards) == 2:
            # Found a match of 3 cards
            second_idx = self.selected_nodes.index(matching_cards[1])
            self.selected_nodes.insert(second_idx + 1, node)
            
            # Remove the matched cards
            for _ in range(3):
                card = self.selected_nodes.pop(second_idx - 1)
                card.state = 3  # Mark as eliminated
            
            reward = 1.0  # Reward for matching
        else:
            # Add to selected cards
            idx = next((i for i, n in enumerate(self.selected_nodes) 
                       if n.type == node.type), len(self.selected_nodes))
            self.selected_nodes.insert(idx, node)
            
        return reward

    def get_state(self) -> Dict:
        """Return the full structured observation dictionary"""
        return {
            "global": self._get_global_state(),
            "cards": self._get_card_features(),
            "queue": self._get_queue_state(),
            "mask": self._get_action_mask()
        }

    def _get_global_state(self) -> np.ndarray:
        """Return global game state features"""
        return np.array([
            len(self.nodes),  # Total cards
            len(self.selected_nodes),  # Selected cards
            self.back_count,  # Undo count
            self.remove_count,  # Remove count
            self.max_back_count,  # Max undo
            self.max_remove_count,  # Max remove
            *[sum(1 for n in self.nodes if n.type == t) 
              for t in range(1, self.card_types + 1)]  # Cards per type
        ], dtype=np.float32)

    def _get_card_features(self) -> np.ndarray:
        """Return matrix of card features"""
        features = np.zeros((80, 80), dtype=np.float32)  # Max possible cards
        for i, node in enumerate(self.nodes):
            if i >= 80:  # Safety check
                break
            features[i] = self._get_card_vector(node)
        return features

    def _get_card_vector(self, node: CardNode) -> np.ndarray:
        """Convert a card to feature vector"""
        vector = np.zeros(80, dtype=np.float32)
        vector[0] = node.type / self.card_types  # Normalized type
        vector[1] = node.state / 3  # Normalized state
        vector[2] = node.z_index / 15  # Normalized layer
        vector[3] = node.top / self.container_height  # Normalized position
        vector[4] = node.left / self.container_width
        vector[5] = len(node.parents) / 4  # Normalized parent count
        return vector

    def _get_queue_state(self) -> np.ndarray:
        """Return state of the selection queue"""
        queue = np.zeros(30, dtype=np.float32)  # Max queue size
        for i, node in enumerate(self.selected_nodes):
            if i >= 30:  # Safety check
                break
            queue[i] = node.type / self.card_types
        return queue

    def _get_action_mask(self) -> np.ndarray:
        """Return mask of valid actions"""
        mask = np.zeros(80, dtype=np.int32)  # Max possible cards
        for i, node in enumerate(self.nodes):
            if i >= 80:  # Safety check
                break
            mask[i] = 1 if node.state == 1 else 0
        return mask

    def render(self):
        """Print current game state"""
        print("\n=== Game State ===")
        print(f"Total cards: {len(self.nodes)}")
        print(f"Selected cards: {len(self.selected_nodes)}")
        print(f"Back count: {self.back_count}/{self.max_back_count}")
        print(f"Remove count: {self.remove_count}/{self.max_remove_count}")
        print("\nSelected cards:")
        for node in self.selected_nodes:
            print(f"Type {node.type}")
        print("\nClickable cards:")
        for node in self.nodes:
            if node.state == 1:
                print(f"Type {node.type} at ({node.left}, {node.top})") 