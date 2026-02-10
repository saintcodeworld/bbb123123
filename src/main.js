import { Game } from './game.js';
import { WalletManager } from './wallet.js';

let game;
let walletManager;

function init() {
  walletManager = new WalletManager();

  const savedWallet = walletManager.loadWallet();
  if (savedWallet) {
    hideWalletModal();
    startGame(savedWallet);
  } else {
    setupWalletModal();
  }
}

function setupWalletModal() {
  const createBtn = document.getElementById('create-wallet-btn');
  const continueBtn = document.getElementById('continue-btn');
  createBtn.addEventListener('click', () => {
    const wallet = walletManager.createWallet();
    displayNewWallet(wallet);
  });

  continueBtn.addEventListener('click', () => {
    const wallet = walletManager.getCurrentWallet();
    walletManager.saveWallet(wallet);
    hideWalletModal();
    startGame(wallet);
  });
}

function displayNewWallet(wallet) {
  document.getElementById('wallet-address-display').textContent = wallet.publicKey;
  document.getElementById('private-key-display').textContent = wallet.privateKeyDisplay;

  document.getElementById('create-wallet-btn').style.display = 'none';
  document.getElementById('wallet-setup').querySelector('p').style.display = 'none';
  document.getElementById('new-wallet-display').style.display = 'block';
}

function hideWalletModal() {
  document.getElementById('wallet-modal').classList.add('hidden');
}

function startGame(wallet) {
  const walletDisplay = document.getElementById('wallet-display');
  const publicKey = wallet.publicKey;
  const shortKey = `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
  walletDisplay.textContent = `Wallet: ${shortKey}`;

  game = new Game(wallet);
  game.start();
}

init();
