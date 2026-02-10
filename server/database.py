import aiosqlite
import json
from datetime import datetime

class Database:
    def __init__(self, db_path='blockmine.db'):
        self.db_path = db_path
        self.db = None

    async def init(self):
        self.db = await aiosqlite.connect(self.db_path)
        await self.create_tables()

    async def create_tables(self):
        await self.db.execute('''
            CREATE TABLE IF NOT EXISTS players (
                wallet_address TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                total_score INTEGER DEFAULT 0,
                total_blocks_mined INTEGER DEFAULT 0,
                last_seen TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        await self.db.execute('''
            CREATE TABLE IF NOT EXISTS world_blocks (
                x INTEGER,
                y INTEGER,
                z INTEGER,
                block_type TEXT,
                placed_by TEXT,
                placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (x, y, z)
            )
        ''')
        
        await self.db.execute('''
            CREATE TABLE IF NOT EXISTS broken_blocks (
                x INTEGER,
                y INTEGER,
                z INTEGER,
                broken_by TEXT,
                broken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (x, y, z)
            )
        ''')

        await self.db.execute('''
            CREATE TABLE IF NOT EXISTS withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_address TEXT NOT NULL,
                amount_points INTEGER NOT NULL,
                amount_tokens_sent REAL NOT NULL,
                tx_signature TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        await self.db.commit()

    async def get_or_create_player(self, wallet_address):
        username = wallet_address[:12] if len(wallet_address) >= 12 else wallet_address
        
        cursor = await self.db.execute(
            'SELECT * FROM players WHERE wallet_address = ?',
            (wallet_address,)
        )
        player = await cursor.fetchone()
        
        if not player:
            await self.db.execute(
                '''INSERT INTO players (wallet_address, username, total_score, total_blocks_mined, last_seen)
                   VALUES (?, ?, 0, 0, ?)''',
                (wallet_address, username, datetime.now())
            )
            await self.db.commit()
            return {
                'wallet_address': wallet_address,
                'username': username,
                'total_score': 0,
                'total_blocks_mined': 0
            }
        
        await self.db.execute(
            'UPDATE players SET last_seen = ? WHERE wallet_address = ?',
            (datetime.now(), wallet_address)
        )
        await self.db.commit()
        
        return {
            'wallet_address': player[0],
            'username': player[1],
            'total_score': player[2],
            'total_blocks_mined': player[3]
        }

    async def update_player_stats(self, wallet_address, score_delta=0, blocks_mined_delta=0):
        await self.db.execute(
            '''UPDATE players 
               SET total_score = total_score + ?,
                   total_blocks_mined = total_blocks_mined + ?
               WHERE wallet_address = ?''',
            (score_delta, blocks_mined_delta, wallet_address)
        )
        await self.db.commit()

    async def get_player_score(self, wallet_address):
        cursor = await self.db.execute(
            'SELECT total_score FROM players WHERE wallet_address = ?',
            (wallet_address,)
        )
        result = await cursor.fetchone()
        return result[0] if result else 0

    async def add_score(self, wallet_address, points):
        await self.db.execute(
            'UPDATE players SET total_score = total_score + ?, total_blocks_mined = total_blocks_mined + 1 WHERE wallet_address = ?',
            (points, wallet_address)
        )
        await self.db.commit()

    async def set_score(self, wallet_address, score):
        await self.db.execute(
            'UPDATE players SET total_score = ? WHERE wallet_address = ?',
            (score, wallet_address)
        )
        await self.db.commit()

    async def deduct_score(self, wallet_address, amount):
        cursor = await self.db.execute(
            'SELECT total_score FROM players WHERE wallet_address = ?',
            (wallet_address,)
        )
        result = await cursor.fetchone()
        if not result or result[0] < amount:
            return False
        await self.db.execute(
            'UPDATE players SET total_score = total_score - ? WHERE wallet_address = ?',
            (amount, wallet_address)
        )
        await self.db.commit()
        return True

    async def record_withdrawal(self, wallet_address, amount_points, amount_tokens_sent, tx_signature, status='completed'):
        await self.db.execute(
            '''INSERT INTO withdrawals (wallet_address, amount_points, amount_tokens_sent, tx_signature, status)
               VALUES (?, ?, ?, ?, ?)''',
            (wallet_address, amount_points, amount_tokens_sent, tx_signature, status)
        )
        await self.db.commit()

    async def mark_block_broken(self, x, y, z, wallet_address):
        await self.db.execute(
            '''INSERT OR REPLACE INTO broken_blocks (x, y, z, broken_by, broken_at)
               VALUES (?, ?, ?, ?, ?)''',
            (x, y, z, wallet_address, datetime.now())
        )
        await self.db.commit()

    async def is_block_broken(self, x, y, z):
        cursor = await self.db.execute(
            'SELECT 1 FROM broken_blocks WHERE x = ? AND y = ? AND z = ?',
            (x, y, z)
        )
        result = await cursor.fetchone()
        return result is not None

    async def get_all_broken_blocks(self):
        cursor = await self.db.execute('SELECT x, y, z FROM broken_blocks')
        blocks = await cursor.fetchall()
        return [{'x': b[0], 'y': b[1], 'z': b[2]} for b in blocks]

    async def close(self):
        if self.db:
            await self.db.close()
