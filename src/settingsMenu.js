import { GameConfig } from './config.js';

export class SettingsMenu {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.createMenu();
    this.setupEventListeners();
  }

  createMenu() {
    const menuHTML = `
      <div id="settings-menu" class="hidden">
        <div class="settings-content">
          <h2>Settings</h2>
          
          <div class="settings-section">
            <h3>Performance</h3>
            
            <label>
              <span>Render Distance: <span id="render-distance-value">2</span></span>
              <input type="range" id="render-distance" min="1" max="4" value="2" step="1">
            </label>
            
            <label>
              <span>Mining Depth: <span id="mining-depth-value">6</span></span>
              <input type="range" id="mining-depth" min="4" max="12" value="6" step="2">
            </label>
            
            <label>
              <span>Fog Density: <span id="fog-density-value">0.02</span></span>
              <input type="range" id="fog-density" min="0.01" max="0.05" value="0.02" step="0.01">
            </label>
            
            <label>
              <input type="checkbox" id="enable-clouds" ${GameConfig.performance.enableClouds ? 'checked' : ''}>
              <span>Enable Clouds</span>
            </label>
            
            <label>
              <input type="checkbox" id="enable-particles" ${GameConfig.performance.enableParticles ? 'checked' : ''}>
              <span>Enable Particles</span>
            </label>
          </div>
          
          <div class="settings-section">
            <h3>Wallet</h3>
            <div class="settings-wallet-section">
              <div class="label">Wallet Address:</div>
              <div class="value public" id="settings-wallet-address">Not connected</div>
              <div class="label">Private Key:</div>
              <div class="value private" id="settings-private-key" style="cursor:pointer;" title="Click to reveal">●●●●●●●●●●●●●●●●</div>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <button id="toggle-private-key-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:11px;">Show Private Key</button>
                <button id="copy-private-key-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:11px;">Copy</button>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h3>Controls</h3>
            <div class="controls-info">
              <p>WASD - Fly • Mouse - Look</p>
              <p>Space - Fly Up • Shift - Fly Down</p>
              <p>Left Click - Mine • ESC - Settings Menu</p>
            </div>
          </div>
          
          <div class="settings-buttons">
            <button id="apply-settings" class="btn-primary">Apply & Continue</button>
            <button id="reset-settings" class="btn-secondary">Reset to Default</button>
          </div>
          
          <div class="settings-info">
            <p>Lower render distance = Better FPS</p>
            <p>Higher fog density = More fog</p>
            <p>Current FPS: <span id="current-fps">--</span></p>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', menuHTML);
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.toggle();
      }
    });

    document.getElementById('render-distance').addEventListener('input', (e) => {
      document.getElementById('render-distance-value').textContent = e.target.value;
    });

    document.getElementById('mining-depth').addEventListener('input', (e) => {
      document.getElementById('mining-depth-value').textContent = e.target.value;
    });

    document.getElementById('fog-density').addEventListener('input', (e) => {
      document.getElementById('fog-density-value').textContent = parseFloat(e.target.value).toFixed(2);
    });

    document.getElementById('apply-settings').addEventListener('click', () => {
      this.applySettings();
      this.close();
    });

    document.getElementById('reset-settings').addEventListener('click', () => {
      this.resetSettings();
    });

    // Private key toggle
    this.privateKeyVisible = false;
    document.getElementById('toggle-private-key-btn').addEventListener('click', () => {
      this.privateKeyVisible = !this.privateKeyVisible;
      const el = document.getElementById('settings-private-key');
      const btn = document.getElementById('toggle-private-key-btn');
      if (this.privateKeyVisible && this.game.wallet) {
        el.textContent = this.game.wallet.privateKeyDisplay || 'N/A';
        btn.textContent = 'Hide Private Key';
      } else {
        el.textContent = '●●●●●●●●●●●●●●●●';
        btn.textContent = 'Show Private Key';
      }
    });

    // Copy private key
    document.getElementById('copy-private-key-btn').addEventListener('click', () => {
      if (this.game.wallet && this.game.wallet.privateKeyDisplay) {
        navigator.clipboard.writeText(this.game.wallet.privateKeyDisplay).then(() => {
          const btn = document.getElementById('copy-private-key-btn');
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
      }
    });
  }

  applySettings() {
    const renderDistance = parseInt(document.getElementById('render-distance').value);
    const miningDepth = parseInt(document.getElementById('mining-depth').value);
    const fogDensity = parseFloat(document.getElementById('fog-density').value);
    const enableClouds = document.getElementById('enable-clouds').checked;
    const enableParticles = document.getElementById('enable-particles').checked;

    GameConfig.world.renderDistance = renderDistance;
    GameConfig.world.miningDepth = miningDepth;
    GameConfig.performance.fogDensity = fogDensity;
    GameConfig.performance.enableClouds = enableClouds;
    GameConfig.performance.enableParticles = enableParticles;

    this.game.worldGenerator.renderDistance = renderDistance;
    this.game.worldGenerator.miningDepth = miningDepth;

    if (this.game.scene.fog && this.game.scene.fog.isFogExp2) {
      this.game.scene.fog.density = fogDensity;
    }

    if (enableClouds && !this.game.clouds) {
      this.game.createClouds();
    } else if (!enableClouds && this.game.clouds) {
      this.game.scene.remove(this.game.clouds);
      this.game.clouds = null;
    }

    this.game.worldGenerator.chunks.forEach((chunk, key) => {
      this.game.worldGenerator.removeChunk(key);
    });

    this.game.worldGenerator.updateChunks(this.game.camera.position);

    console.log('Settings applied:', {
      renderDistance,
      miningDepth,
      fogDensity,
      enableClouds,
      enableParticles
    });
  }

  resetSettings() {
    document.getElementById('render-distance').value = 2;
    document.getElementById('render-distance-value').textContent = 2;
    document.getElementById('mining-depth').value = 6;
    document.getElementById('mining-depth-value').textContent = 6;
    document.getElementById('fog-density').value = 0.02;
    document.getElementById('fog-density-value').textContent = '0.02';
    document.getElementById('enable-clouds').checked = false;
    document.getElementById('enable-particles').checked = true;

    this.applySettings();
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    const menu = document.getElementById('settings-menu');
    menu.classList.remove('hidden');

    document.exitPointerLock();

    const currentFps = document.getElementById('fps-counter').textContent.split('|')[0].replace('FPS: ', '').trim();
    document.getElementById('current-fps').textContent = currentFps;

    document.getElementById('render-distance').value = GameConfig.world.renderDistance;
    document.getElementById('render-distance-value').textContent = GameConfig.world.renderDistance;
    document.getElementById('mining-depth').value = GameConfig.world.miningDepth;
    document.getElementById('mining-depth-value').textContent = GameConfig.world.miningDepth;
    document.getElementById('fog-density').value = GameConfig.performance.fogDensity;
    document.getElementById('fog-density-value').textContent = GameConfig.performance.fogDensity.toFixed(2);

    // Update wallet info in settings
    if (this.game.wallet) {
      document.getElementById('settings-wallet-address').textContent = this.game.wallet.publicKey;
    }

    // Reset private key visibility when opening
    this.privateKeyVisible = false;
    document.getElementById('settings-private-key').textContent = '●●●●●●●●●●●●●●●●';
    document.getElementById('toggle-private-key-btn').textContent = 'Show Private Key';
  }

  close() {
    this.isOpen = false;
    const menu = document.getElementById('settings-menu');
    menu.classList.add('hidden');

    this.game.renderer.domElement.requestPointerLock();
  }
}
