import sqlite3
from datetime import datetime

import os

def view_database():
    #Get absolute path to database relative to script file
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ore_mine.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=" * 60)
    print("Ore Miner Database Viewer")
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
    
    print("\n" + "-" * 60)
    print("WITHDRAWALS:")
    print("-" * 60)
    
    try:
        cursor.execute("SELECT COUNT(*) FROM withdrawals")
        withdrawal_count = cursor.fetchone()[0]
        print(f"Total Withdrawals: {withdrawal_count}")
        
        if withdrawal_count > 0:
            print("\nRecent Withdrawals (Last 10):")
            cursor.execute("SELECT wallet_address, amount_tokens_sent, tx_signature, status, created_at FROM withdrawals ORDER BY created_at DESC LIMIT 10")
            for row in cursor.fetchall():
                wallet, amount, tx, status, created_at = row
                print(f"\nTime: {created_at}")
                print(f"Wallet: {wallet}")
                print(f"Amount: {amount} tokens")
                print(f"Status: {status}")
                print(f"TX: {tx}")
    except sqlite3.OperationalError:
        print("No withdrawals table found (run server to create it)")
    
    print("\n" + "=" * 60)
    
    conn.close()

if __name__ == "__main__":
    try:
        view_database()
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure ore_mine.db exists (run server first)")

