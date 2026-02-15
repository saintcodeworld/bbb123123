import sqlite3
import sys

def reset_world():
    response = input("This will DELETE ALL broken blocks. Are you sure? (yes/no): ")
    
    if response.lower() != 'yes':
        print("Cancelled.")
        return
    
    conn = sqlite3.connect('ore_mine.db')
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM broken_blocks")
    conn.commit()
    
    count = cursor.rowcount
    print(f"\n✅ World reset! Removed {count} broken blocks.")
    print("Players and their stats were preserved.")
    
    conn.close()

if __name__ == "__main__":
    try:
        reset_world()
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Make sure ore_mine.db exists (run server first)")

