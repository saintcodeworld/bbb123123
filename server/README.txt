MULTIPLAYER SERVER SETUP
========================

1. Install Python 3.8 or higher

2. Install dependencies:
   cd server
   pip install -r requirements.txt

3. Run the server:
   python server.py

The server will start on ws://0.0.0.0:8765
Database will be created automatically (blockmine.db)

The client will automatically connect when the game starts.

FEATURES:
- Wallet-based authentication
- SQLite database for persistent player data
- Shared world with synchronized seed (Seed: 42)
- Usernames from first 12 chars of wallet address
- Real-time player position synchronization
- Player mining animations
- Persistent block breaking (stored in database)
- All players see the same world state
- Pickaxe upgrade notifications
- Player join/leave notifications
- Automatic reconnection on disconnect

DATABASE:
- blockmine.db stores:
  * Player data (wallet, username, scores, stats)
  * Broken blocks (shared across all players)
  * Player last seen timestamps

