import sqlite3
from datetime import datetime

def view_database():
    conn = sqlite3.connect('blockmine.db')
    cursor = conn.cursor()
    
    print("=" * 60)
    print("BlockMine Database Viewer")
    print("=" * 60)
    
    cursor.execute("SELECT COUNT(*) FROM players")
    player_count = cursor.fetchone()[0]
    print(f"\nTotal Players: {player_count}")
    
    if player_count > 0:
        print("\n" + "-" * 60)
        print("PLAYERS:")
        print("-" * 60)
        cursor.execute("SELECT wallet_address, username, total_score, total_blocks_mined, last_seen FROM players ORDER BY total_score DESC")
        for row in cursor.fetchall():
            wallet, username, score, blocks, last_seen = row
            print(f"\nUsername: {username}")
            print(f"Wallet: {wallet}")
            print(f"Score: {score}")
            print(f"Blocks Mined: {blocks}")
            print(f"Last Seen: {last_seen}")
    
    cursor.execute("SELECT COUNT(*) FROM broken_blocks")
    broken_count = cursor.fetchone()[0]
    print(f"\n" + "-" * 60)
    print(f"Total Broken Blocks: {broken_count}")
    print("-" * 60)
    
    if broken_count > 0 and broken_count < 20:
        print("\nBroken Blocks:")
        cursor.execute("SELECT x, y, z, broken_by, broken_at FROM broken_blocks ORDER BY broken_at DESC LIMIT 10")
        for row in cursor.fetchall():
            x, y, z, broken_by, broken_at = row
            print(f"  Block at ({x}, {y}, {z}) broken by {broken_by[:12]}... at {broken_at}")
    
    print("\n" + "=" * 60)
    
    conn.close()

if __name__ == "__main__":
    try:
        view_database()
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure blockmine.db exists (run server first)")

