export class NetworkManager {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.playerId = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.lastPositionSent = { x: 0, y: 0, z: 0 };
    this.lastRotationSent = { x: 0, y: 0 };
    this.positionThreshold = 0.1;
    this.rotationThreshold = 0.05;
    this.isInitialized = false;
  }

  connect(url = 'wss://flaky-leeanna-baptismally.ngrok-free.dev') {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      console.log('Connecting to server at:', url);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connection established, sending handshake...');
        this.reconnectAttempts = 0;

        const walletAddress = this.game.wallet.publicKey || 'unknown';
        console.log('Sending wallet address:', walletAddress);

        this.ws.send(JSON.stringify({
          type: 'connect',
          wallet_address: walletAddress
        }));
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };

      this.ws.onclose = (event) => {
        console.log('❌ Disconnected from server', event.code, event.reason);
        this.connected = false;
        this.updateConnectionStatus(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        console.error('Make sure server is running: python server/server.py');
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.updateConnectionStatus(false);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case 'init':
        this.playerId = data.player_id;
        this.connected = true;
        console.log(`✅ Handshake complete! Player ID: ${this.playerId}`);
        console.log(`World Seed: ${data.world_seed}`);

        if (this.game.voiceChat) {
          this.game.voiceChat.setPlayerId(this.playerId);
        }

        if (data.server_score !== undefined) {
          this.game.syncServerScore(data.server_score);
        }

        this.game.otherPlayers.forEach((player, id) => {
          player.destroy();
        });
        this.game.otherPlayers.clear();

        if (!this.isInitialized) {
          this.isInitialized = true;
          this.game.initializeSharedWorld(data.world_seed, data.broken_blocks);
        }

        for (const [id, playerData] of Object.entries(data.players)) {
          this.game.addOtherPlayer(parseInt(id), playerData);
        }

        this.updateConnectionStatus(true);
        break;

      case 'player_joined':
        console.log(`Player ${data.player.id} joined`);
        this.game.addOtherPlayer(data.player.id, data.player);
        break;

      case 'player_left':
        console.log(`Player ${data.player_id} left`);
        this.game.removeOtherPlayer(data.player_id);
        break;

      case 'player_moved':
        this.game.updateOtherPlayer(data.player_id, {
          position: data.position,
          rotation: data.rotation
        });
        break;

      case 'player_mining':
        this.game.updateOtherPlayerMining(data.player_id, data.is_mining, data.block);
        break;

      case 'block_broken':
        this.game.handleRemoteBlockBreak(data.player_id, data.block);
        break;

      case 'pickaxe_upgrade':
        this.game.updateOtherPlayerPickaxe(data.player_id, data.pickaxe);
        break;

      case 'withdraw_result':
        this.game.handleWithdrawResult(data);
        break;

      case 'voice_offer':
        if (this.game.voiceChat) {
          this.game.voiceChat.handleOffer(data.from_id, data.offer);
        }
        break;

      case 'voice_answer':
        if (this.game.voiceChat) {
          this.game.voiceChat.handleAnswer(data.from_id, data.answer);
        }
        break;

      case 'voice_ice':
        if (this.game.voiceChat) {
          this.game.voiceChat.handleIceCandidate(data.from_id, data.candidate);
        }
        break;
    }
  }

  sendPosition(position, rotation) {
    if (!this.connected) return;

    const posChanged =
      Math.abs(position.x - this.lastPositionSent.x) > this.positionThreshold ||
      Math.abs(position.y - this.lastPositionSent.y) > this.positionThreshold ||
      Math.abs(position.z - this.lastPositionSent.z) > this.positionThreshold;

    const rotChanged =
      Math.abs(rotation.x - this.lastRotationSent.x) > this.rotationThreshold ||
      Math.abs(rotation.y - this.lastRotationSent.y) > this.rotationThreshold;

    if (posChanged || rotChanged) {
      this.send({
        type: 'position',
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: rotation.x, y: rotation.y }
      });

      this.lastPositionSent = { ...position };
      this.lastRotationSent = { ...rotation };
    }
  }

  sendMiningState(isMining, block = null) {
    if (!this.connected) return;

    this.send({
      type: 'mining',
      is_mining: isMining,
      block: block
    });
  }

  sendBlockBroken(block) {
    if (!this.connected) return;

    this.send({
      type: 'block_broken',
      block: block
    });
  }

  sendPickaxeUpgrade(pickaxe) {
    if (!this.connected) return;

    this.send({
      type: 'pickaxe_upgrade',
      pickaxe: pickaxe
    });
  }

  sendWithdraw() {
    if (!this.connected) return;
    this.game.saveState(); // Ensure state is saved
    console.log(`[Network] Sending withdraw request. Score: ${this.game.score}`);
    this.send({ type: 'withdraw', score: this.game.score });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.textContent = connected ? 'Online' : 'Offline';
      statusEl.className = connected ? 'connected' : 'disconnected';
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

