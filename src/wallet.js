import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export class WalletManager {
  constructor() {
    this.currentWallet = null;
  }

  createWallet() {
    const keypair = Keypair.generate();
    const privateKeyBase58 = bs58.encode(keypair.secretKey);

    this.currentWallet = {
      publicKey: keypair.publicKey.toBase58(),
      secretKey: Array.from(keypair.secretKey),
      privateKeyDisplay: privateKeyBase58,
      keypair: keypair
    };

    return this.currentWallet;
  }

  saveWallet(wallet) {
    const walletData = {
      publicKey: wallet.publicKey,
      secretKey: wallet.secretKey,
      privateKeyDisplay: wallet.privateKeyDisplay
    };
    localStorage.setItem('skymine_wallet', JSON.stringify(walletData));
  }

  loadWallet() {
    const saved = localStorage.getItem('skymine_wallet');
    if (!saved) return null;

    try {
      const walletData = JSON.parse(saved);
      const keypair = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));

      // Regenerate privateKeyDisplay if missing (migration from old format)
      let privateKeyDisplay = walletData.privateKeyDisplay;
      if (!privateKeyDisplay) {
        privateKeyDisplay = bs58.encode(keypair.secretKey);
      }

      this.currentWallet = {
        publicKey: walletData.publicKey,
        secretKey: walletData.secretKey,
        privateKeyDisplay: privateKeyDisplay,
        keypair: keypair
      };

      return this.currentWallet;
    } catch (error) {
      console.error('Failed to load wallet:', error);
      return null;
    }
  }

  getCurrentWallet() {
    return this.currentWallet;
  }
}
