import { GameConfig } from './config.js';

export class InventoryMenu {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.createMenu();
    this.setupEvents();
  }

  createMenu() {
    const el = document.createElement('div');
    el.id = 'inventory-menu';
    el.className = 'hidden';
    el.innerHTML = `
      <div class="inv-overlay"></div>
      <div class="inv-container">
        <div class="inv-header">
          <h2>Inventory</h2>
          <span class="inv-close">E to close</span>
        </div>
        
        <div class="inv-content-scroll">
          <div class="inv-stats">
            <div class="inv-stat">
              <span class="inv-stat-label">Tokens</span>
              <span class="inv-stat-value" id="inv-score">0</span>
            </div>
            <div class="inv-stat">
              <span class="inv-stat-label">Blocks Mined</span>
              <span class="inv-stat-value" id="inv-blocks">0</span>
            </div>
            <div class="inv-stat">
              <span class="inv-stat-label">Current Pickaxe</span>
              <span class="inv-stat-value" id="inv-current-pick">Stone</span>
            </div>
          </div>

          <div class="inv-section">
            <h3>Pickaxe Upgrades</h3>
            <div class="inv-pickaxes" id="inv-pickaxe-grid"></div>
          </div>

          <div class="inv-section">
            <h3>Blocks Collected</h3>
            <div class="inv-blocks-grid" id="inv-blocks-grid"></div>
          </div>

          <div class="inv-section inv-withdraw-section">
            <h3>Withdraw Tokens</h3>
            <div class="inv-withdraw-rate">Minimum withdrawal: 10,000 Tokens</div>
            <button class="inv-withdraw-btn" id="inv-withdraw-btn">Withdraw 10,000 Tokens</button>
            <div id="inv-withdraw-status" class="inv-withdraw-status"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  setupEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        if (this.game.settingsMenu.isOpen) return;
        this.toggle();
      }
    });

    document.getElementById('inv-withdraw-btn').addEventListener('click', () => {
      this.handleWithdraw();
    });
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    document.getElementById('inventory-menu').classList.remove('hidden');
    document.exitPointerLock();
    // Force score update from game state
    this.game.score = this.game.gameState.score;
    this.refresh();
  }

  close() {
    this.isOpen = false;
    document.getElementById('inventory-menu').classList.add('hidden');
    this.game.renderer.domElement.requestPointerLock();
  }

  refresh() {
    const state = this.game.gameState;

    document.getElementById('inv-score').textContent = state.score;
    document.getElementById('inv-blocks').textContent = state.totalBlocksMined;
    document.getElementById('inv-current-pick').textContent =
      GameConfig.mining.pickaxeTiers[state.currentPickaxe].name;

    const grid = document.getElementById('inv-pickaxe-grid');
    grid.innerHTML = '';

    const tiers = Object.entries(GameConfig.mining.pickaxeTiers);
    tiers.forEach(([key, tier]) => {
      const owned = state.ownedPickaxes.includes(key);
      const active = state.currentPickaxe === key;
      const canAfford = state.score >= tier.cost;

      const item = document.createElement('div');
      item.className = `inv-pick-item ${active ? 'active' : ''} ${!owned && !canAfford ? 'locked' : ''}`;

      let btnClass = 'inv-btn';
      let btnText = '';
      if (active) { btnClass += ' owned'; btnText = 'EQUIPPED'; }
      else if (owned) { btnClass += ' owned'; btnText = 'EQUIP'; }
      else if (canAfford) { btnClass += ' can-buy'; btnText = `BUY (${tier.cost})`; }
      else { btnClass += ' cant-buy'; btnText = `${tier.cost} Tokens`; }

      item.innerHTML = `
        <div class="inv-pick-left">
          <span class="inv-pick-icon">⛏</span>
          <div>
            <div class="inv-pick-name">${tier.name} Pickaxe</div>
            <div class="inv-pick-speed">${tier.speed}x mining speed</div>
          </div>
        </div>
        <button class="${btnClass}" data-tier="${key}">${btnText}</button>
      `;

      const btn = item.querySelector('button');
      btn.addEventListener('click', () => this.handlePickaxeClick(key));

      grid.appendChild(item);
    });

    const blocksGrid = document.getElementById('inv-blocks-grid');
    blocksGrid.innerHTML = '';

    const blockTypes = [
      { key: 'stone', name: 'Stone', pts: GameConfig.mining.points.stone },
      { key: 'coalOre', name: 'Coal', pts: GameConfig.mining.points.coalOre },
      { key: 'ironOre', name: 'Iron', pts: GameConfig.mining.points.ironOre },
      { key: 'goldOre', name: 'Gold', pts: GameConfig.mining.points.goldOre },
      { key: 'emeraldOre', name: 'Emerald', pts: GameConfig.mining.points.emeraldOre },
      { key: 'diamondOre', name: 'Diamond', pts: GameConfig.mining.points.diamondOre }
    ];

    blockTypes.forEach(bt => {
      const count = state.blocksMined[bt.key] || 0;
      const el = document.createElement('div');
      el.className = 'inv-block-item';
      el.innerHTML = `
        <span class="inv-block-count">${count}</span>
        <span class="inv-block-name">${bt.name}</span>
        <span class="inv-block-pts">${bt.pts} Tokens each</span>
      `;
      blocksGrid.appendChild(el);
    });

    this.refreshWithdrawSection();
  }

  handlePickaxeClick(tier) {
    const state = this.game.gameState;
    const tierData = GameConfig.mining.pickaxeTiers[tier];

    if (state.currentPickaxe === tier) return;

    if (state.ownedPickaxes.includes(tier)) {
      state.currentPickaxe = tier;
      this.game.miningSystem.upgradeTo(tier);
      this.game.pickaxe.switchTier(tier);
      this.game.networkManager.sendPickaxeUpgrade(tier);
      this.game.saveState();
      this.refresh();
      return;
    }

    if (state.score >= tierData.cost) {
      state.score -= tierData.cost;
      this.game.score = state.score;
      state.ownedPickaxes.push(tier);
      state.currentPickaxe = tier;
      this.game.miningSystem.upgradeTo(tier);
      this.game.pickaxe.switchTier(tier);
      this.game.networkManager.sendPickaxeUpgrade(tier);
      document.getElementById('score').textContent = `Tokens: ${state.score}`;
      this.game.saveState();
      this.refresh();
    }
  }

  handleWithdraw() {
    const btn = document.getElementById('inv-withdraw-btn');
    const status = document.getElementById('inv-withdraw-status');

    // Sync score one last time
    this.game.score = this.game.gameState.score;

    if (this.game.score < 10000) {
      status.textContent = `Need 10,000 tokens (you have ${this.game.score})`;
      status.className = 'inv-withdraw-status error';
      return;
    }

    if (!this.game.networkManager.connected) {
      status.textContent = 'Not connected to server';
      status.className = 'inv-withdraw-status error';
      return;
    }

    btn.disabled = true;
    status.textContent = 'Processing withdrawal...';
    status.className = 'inv-withdraw-status pending';
    this.game.networkManager.sendWithdraw();
  }

  handleWithdrawResult(data) {
    const btn = document.getElementById('inv-withdraw-btn');
    const status = document.getElementById('inv-withdraw-status');

    btn.disabled = false;

    if (data.success) {
      status.textContent = 'Withdrawal Successful!';
      status.className = 'inv-withdraw-status success';
      this.refreshWithdrawSection();
      this.refresh();
    } else {
      status.textContent = data.error || 'Withdrawal failed';
      status.className = 'inv-withdraw-status error';
    }
  }

  refreshWithdrawSection() {
    const btn = document.getElementById('inv-withdraw-btn');
    if (btn) btn.disabled = this.game.score < 10000;
  }
}
