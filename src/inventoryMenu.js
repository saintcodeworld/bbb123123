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
    `;
    document.body.appendChild(el);

    const style = document.createElement('style');
    style.textContent = `
      #inventory-menu { position:fixed; top:0; left:0; width:100%; height:100%; z-index:5000; }
      #inventory-menu.hidden { display:none; }
      .inv-overlay { position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); }
      .inv-container {
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        background:#1a1a1a; border:3px solid #555; width:500px; max-height:80vh;
        overflow-y:auto; font-family:'Minecraft','Courier New',monospace; color:#fff;
      }
      .inv-header {
        display:flex; justify-content:space-between; align-items:center;
        padding:15px 20px; border-bottom:2px solid #444; background:#222;
      }
      .inv-header h2 { margin:0; color:#fff; font-size:18px; }
      .inv-close { color:#888; font-size:12px; }
      .inv-stats {
        display:flex; gap:10px; padding:15px 20px; background:#1e1e1e; border-bottom:1px solid #333;
      }
      .inv-stat {
        flex:1; text-align:center; padding:8px; background:#252525; border:1px solid #333;
      }
      .inv-stat-label { display:block; font-size:10px; color:#888; margin-bottom:4px; }
      .inv-stat-value { display:block; font-size:16px; color:#0f0; }
      .inv-section { padding:15px 20px; }
      .inv-section h3 { color:#ff0; font-size:14px; margin:0 0 12px; }
      .inv-pickaxes { display:flex; flex-direction:column; gap:8px; }
      .inv-pick-item {
        display:flex; align-items:center; justify-content:space-between;
        padding:10px 15px; background:#252525; border:2px solid #333; cursor:pointer;
      }
      .inv-pick-item:hover { border-color:#666; }
      .inv-pick-item.active { border-color:#0f0; background:#1a2a1a; }
      .inv-pick-item.locked { opacity:0.5; cursor:not-allowed; }
      .inv-pick-left { display:flex; align-items:center; gap:12px; }
      .inv-pick-icon { font-size:20px; }
      .inv-pick-name { font-size:14px; }
      .inv-pick-speed { font-size:11px; color:#888; }
      .inv-pick-btn {
        padding:6px 14px; border:2px solid #555; background:#333; color:#fff;
        font-family:'Minecraft','Courier New',monospace; font-size:12px; cursor:pointer;
      }
      .inv-pick-btn.owned { background:#1a3a1a; border-color:#0a0; color:#0f0; }
      .inv-pick-btn.can-buy { background:#2a2a1a; border-color:#aa0; color:#ff0; }
      .inv-pick-btn.cant-buy { background:#2a1a1a; border-color:#a00; color:#f66; cursor:not-allowed; }
      .inv-pick-btn:hover:not(.cant-buy):not(.owned) { background:#444; }
      .inv-blocks-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
      .inv-block-item {
        text-align:center; padding:10px 5px; background:#252525; border:1px solid #333;
      }
      .inv-block-count { font-size:18px; color:#0f0; display:block; }
      .inv-block-name { font-size:10px; color:#aaa; display:block; margin-top:4px; }
      .inv-block-pts { font-size:9px; color:#666; display:block; }
      .inv-withdraw-section { border-top:2px solid #444; margin-top:10px; }
      .inv-withdraw-rate { font-size:13px; color:#ffaa00; margin-bottom:12px; }
      .inv-withdraw-btn {
        width:100%; padding:12px; border:2px solid #ffaa00; background:#2a2a1a;
        color:#ffaa00; font-family:'Minecraft','Courier New',monospace; font-size:14px;
        cursor:pointer; transition:background 0.2s;
      }
      .inv-withdraw-btn:hover:not(:disabled) { background:#3a3a2a; }
      .inv-withdraw-btn:disabled { opacity:0.4; cursor:not-allowed; border-color:#555; color:#666; }
      .inv-withdraw-status { margin-top:10px; font-size:11px; min-height:16px; }
      .inv-withdraw-status.success { color:#0f0; }
      .inv-withdraw-status.error { color:#f66; }
      .inv-withdraw-status.pending { color:#ffaa00; }
    `;
    document.head.appendChild(style);
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

      let btnClass = 'inv-pick-btn';
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
      const shortTx = data.tx_signature
        ? `${data.tx_signature.slice(0, 8)}...${data.tx_signature.slice(-8)}`
        : '';
      status.textContent = `Sent ${data.amount_tokens} Tokens! TX: ${shortTx}`;
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
