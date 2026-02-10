import os
import asyncio
from dotenv import load_dotenv
from solders.keypair import Keypair
from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey

load_dotenv()

TREASURY_PRIVATE_KEY = os.getenv('TREASURY_PRIVATE_KEY')
SOLANA_RPC_URL = os.getenv('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
TOKEN_MINT_ADDRESS = os.getenv('TOKEN_MINT_ADDRESS')

async def check():
    if not TREASURY_PRIVATE_KEY:
        print("Error: TREASURY_PRIVATE_KEY not found in .env")
        return

    try:
        keypair = Keypair.from_base58_string(TREASURY_PRIVATE_KEY)
        pubkey = keypair.pubkey()
        print(f"Treasury Wallet Address: {pubkey}")
        
        client = AsyncClient(SOLANA_RPC_URL)
        
        # Check SOL Balance
        balance_resp = await client.get_balance(pubkey)
        sol_balance = balance_resp.value / 1e9
        print(f"SOL Balance: {sol_balance} SOL")
        
        if sol_balance < 0.002:  # Min rent exemption is around 0.002 SOL usually for accounts, plus fees
            print("CRITICAL: Treasury wallet has very low/zero SOL. It creates transaction failures.")
            print("Fix: Send at least 0.01 SOL to this address.")

        if TOKEN_MINT_ADDRESS:
            # Check Token Balance
            try:
                mint_pubkey = Pubkey.from_string(TOKEN_MINT_ADDRESS)
                
                TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
                ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
                
                seeds = [bytes(pubkey), bytes(TOKEN_PROGRAM_ID), bytes(mint_pubkey)]
                ata, _ = Pubkey.find_program_address(seeds, ASSOCIATED_TOKEN_PROGRAM_ID)
                
                print(f"Treasury ATA: {ata}")
                
                try:
                    token_balance_resp = await client.get_token_account_balance(ata)
                    if token_balance_resp.value:
                        print(f"Token Balance: {token_balance_resp.value.ui_amount}")
                    else:
                        print("Token Account exists but has no balance info??")
                except Exception as e:
                     print(f"Could not get token balance (likely ATA doesn't exist): {e}")

            except Exception as e:
                print(f"Error checking token mint: {e}")

        await client.close()

    except Exception as e:
        print(f"Error checking wallet: {e}")

if __name__ == "__main__":
    asyncio.run(check())
