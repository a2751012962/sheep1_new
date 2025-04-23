from game import SheepGame
import numpy as np

def test_game():
    # Initialize game
    game = SheepGame(card_types=18)
    
    # Test reset and initial state
    state = game.reset()
    print("\n=== Initial State ===")
    print(f"Global state shape: {state['global'].shape}")  # Should be (19,)
    print(f"Cards matrix shape: {state['cards'].shape}")   # Should be (80, 80)
    print(f"Queue state shape: {state['queue'].shape}")    # Should be (30,)
    print(f"Action mask shape: {state['mask'].shape}")     # Should be (80,)
    
    # Verify card counts
    total_cards = len(game.nodes)
    print(f"\nTotal cards: {total_cards}")  # Should be 270
    
    # Count clickable cards
    clickable = sum(1 for node in game.nodes if node.state == 1)
    print(f"Initially clickable cards: {clickable}")
    
    # Test card selection
    print("\n=== Testing Card Selection ===")
    # Find first clickable card
    first_action = next(i for i, node in enumerate(game.nodes) if node.state == 1)
    reward, done = game.step(first_action)
    print(f"First action reward: {reward}, done: {done}")
    print(f"Selected cards: {len(game.selected_nodes)}")
    
    # Print game state
    game.render()

if __name__ == "__main__":
    test_game() 