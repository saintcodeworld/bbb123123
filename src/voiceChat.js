const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const VOICE_RANGE = 30;
const MAX_VOLUME = 1;

export class VoiceChat {
  constructor(networkManager) {
    this.networkManager = networkManager;
    this.localStream = null;
    this.peers = new Map();
    this.gainNodes = new Map();
    this.audioContext = null;
    this.muted = false;
    this.deafened = false;
    this.enabled = false;
    this.initPromise = null;
    this.pendingQueue = [];
    this.myPlayerId = null;
    this.iceCandidateBuffer = new Map();
    this.analysers = new Map();
    this.localAnalyser = null;
    this.debugInterval = null;
    this.audioElements = new Map();

    this.createUI();
    this.setupAutoResume();
  }

  createUI() {
    const container = document.createElement('div');
    container.id = 'voice-chat-ui';
    container.innerHTML = `
      <button id="voice-toggle" title="Toggle Microphone (V)">🎤 ON</button>
      <button id="voice-deafen" title="Toggle Deafen (B)">🔊</button>
      <div id="voice-local-level" style="color:#0f0;font-size:10px;font-family:monospace;"></div>
      <div id="voice-players"></div>
    `;
    document.body.appendChild(container);

    const style = document.createElement('style');
    style.textContent = `
      #voice-chat-ui {
        position: fixed;
        bottom: 60px;
        right: 20px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        z-index: 150;
        pointer-events: all;
      }
      #voice-chat-ui button {
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        border: 2px solid #555;
        padding: 8px 14px;
        font-family: 'Minecraft', 'Courier New', monospace;
        font-size: 12px;
        cursor: pointer;
        min-width: 80px;
      }
      #voice-chat-ui button:hover { border-color: #888; }
      #voice-chat-ui button.active { border-color: #0f0; background: rgba(0, 80, 0, 0.7); }
      #voice-chat-ui button.deafened { border-color: #f00; background: rgba(80, 0, 0, 0.7); }
      #voice-players {
        display: flex;
        flex-direction: column;
        gap: 3px;
        align-items: flex-end;
      }
      .voice-player-indicator {
        background: rgba(0, 0, 0, 0.6);
        color: #aaa;
        padding: 3px 8px;
        font-family: 'Minecraft', 'Courier New', monospace;
        font-size: 10px;
        border: 1px solid #333;
      }
      .voice-player-indicator.connected {
        color: #0f0;
        border-color: #0f0;
      }
    `;
    document.head.appendChild(style);

    document.getElementById('voice-toggle').addEventListener('click', () => this.toggleMute());
    document.getElementById('voice-deafen').addEventListener('click', () => this.toggleDeafen());

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (e.code === 'KeyV') this.toggleMute();
      if (e.code === 'KeyB') this.toggleDeafen();
    });

    const btn = document.getElementById('voice-toggle');
    btn.classList.add('active');
  }

  setupAutoResume() {
    const resume = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('🎤 AudioContext resumed via user gesture');
          this.rebuildAudioPipelines();
        });
      }
    };
    document.addEventListener('click', resume, { once: false });
    document.addEventListener('keydown', resume, { once: false });
    document.addEventListener('mousedown', resume, { once: false });
  }

  rebuildAudioPipelines() {
    this.peers.forEach((pc, peerId) => {
      const receivers = pc.getReceivers();
      receivers.forEach(r => {
        if (r.track && r.track.kind === 'audio' && r.track.readyState === 'live') {
          const stream = new MediaStream([r.track]);
          console.log(`🎤 Rebuilding audio pipeline for peer ${peerId}`);
          this.gainNodes.delete(peerId);
          this.analysers.delete(peerId);
          this.setupRemoteAudio(peerId, stream);
        }
      });
    });
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });

        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
        this.muted = false;

        this.localAnalyser = this.audioContext.createAnalyser();
        this.localAnalyser.fftSize = 256;
        const localSource = this.audioContext.createMediaStreamSource(this.localStream);
        localSource.connect(this.localAnalyser);

        this.enabled = true;
        console.log('🎤 Voice chat initialized - MIC IS ON');
        console.log(`🎤 Local tracks: ${this.localStream.getAudioTracks().map(t => `${t.label} enabled=${t.enabled} readyState=${t.readyState}`).join(', ')}`);

        this.startDebugLogging();
        await this.processPendingQueue();
      } catch (err) {
        console.warn('🎤 Microphone access denied:', err.message);
        this.enabled = false;
        const btn = document.getElementById('voice-toggle');
        btn.textContent = '🎤 NO MIC';
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
        btn.classList.remove('active');
      }
    })();

    return this.initPromise;
  }

  async processPendingQueue() {
    const queue = [...this.pendingQueue];
    this.pendingQueue = [];
    for (const action of queue) {
      try {
        await action();
      } catch (err) {
        console.error('🎤 Error processing queued action:', err);
      }
    }
  }

  setPlayerId(id) {
    this.myPlayerId = id;
  }

  toggleMute() {
    if (!this.enabled) return;
    this.muted = !this.muted;

    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.muted;
    });

    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const btn = document.getElementById('voice-toggle');
    if (this.muted) {
      btn.textContent = '🎤 OFF';
      btn.classList.remove('active');
      console.log('🎤 Microphone MUTED');
    } else {
      btn.textContent = '🎤 ON';
      btn.classList.add('active');
      console.log('🎤 Microphone UNMUTED');
    }
  }

  toggleDeafen() {
    this.deafened = !this.deafened;

    const btn = document.getElementById('voice-deafen');
    if (this.deafened) {
      btn.textContent = '🔇';
      btn.classList.add('deafened');
      this.audioElements.forEach(audio => {
        audio.volume = 0;
      });
    } else {
      btn.textContent = '🔊';
      btn.classList.remove('deafened');
      // Volume will be restored by next updateProximity call
    }
  }

  createPeerConnection(peerId) {
    if (this.peers.has(peerId)) {
      this.peers.get(peerId).close();
      this.peers.delete(peerId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(peerId, pc);

    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream);
      console.log(`🎤 Added track to peer ${peerId}: kind=${track.kind} enabled=${track.enabled} readyState=${track.readyState}`);
    });

    pc.ontrack = (event) => {
      const track = event.track;
      console.log(`🎤 Got remote track from player ${peerId}: kind=${track.kind} enabled=${track.enabled} muted=${track.muted} readyState=${track.readyState}`);

      track.onunmute = () => {
        console.log(`🎤 Remote track from ${peerId} UNMUTED - audio should flow now`);
        this.setupRemoteAudio(peerId, event.streams[0]);
      };

      if (!track.muted) {
        this.setupRemoteAudio(peerId, event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.networkManager.send({
          type: 'voice_ice',
          target_id: peerId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`🎤 Peer ${peerId} connection: ${pc.connectionState}`);
      const indicator = document.getElementById(`voice-p-${peerId}`);
      if (pc.connectionState === 'connected' && indicator) {
        indicator.classList.add('connected');
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        if (indicator) indicator.classList.remove('connected');
      }
    };

    return pc;
  }

  async connectToPeer(peerId) {
    if (!this.enabled) {
      this.pendingQueue.push(() => this.connectToPeer(peerId));
      return;
    }

    if (this.peers.has(peerId)) return;

    if (this.myPlayerId !== null && this.myPlayerId > peerId) {
      return;
    }

    console.log(`🎤 Creating offer for player ${peerId}`);
    const pc = this.createPeerConnection(peerId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.networkManager.send({
        type: 'voice_offer',
        target_id: peerId,
        offer: pc.localDescription.toJSON()
      });
    } catch (err) {
      console.error(`🎤 Failed to create offer for ${peerId}:`, err);
      this.peers.delete(peerId);
    }
  }

  async handleOffer(fromId, offer) {
    if (!this.enabled) {
      console.log(`🎤 Queuing offer from ${fromId} (init pending)`);
      this.pendingQueue.push(() => this.handleOffer(fromId, offer));
      return;
    }

    console.log(`🎤 Handling offer from player ${fromId}`);
    const pc = this.createPeerConnection(fromId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const buffered = this.iceCandidateBuffer.get(fromId) || [];
      for (const c of buffered) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
      this.iceCandidateBuffer.delete(fromId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.networkManager.send({
        type: 'voice_answer',
        target_id: fromId,
        answer: pc.localDescription.toJSON()
      });
    } catch (err) {
      console.error(`🎤 Failed to handle offer from ${fromId}:`, err);
    }
  }

  async handleAnswer(fromId, answer) {
    if (!this.enabled) {
      this.pendingQueue.push(() => this.handleAnswer(fromId, answer));
      return;
    }

    const pc = this.peers.get(fromId);
    if (pc && pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`🎤 Answer set from player ${fromId}`);

        const buffered = this.iceCandidateBuffer.get(fromId) || [];
        for (const c of buffered) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        this.iceCandidateBuffer.delete(fromId);
      } catch (err) {
        console.error(`🎤 Failed to set answer from ${fromId}:`, err);
      }
    }
  }

  async handleIceCandidate(fromId, candidate) {
    if (!this.enabled) {
      this.pendingQueue.push(() => this.handleIceCandidate(fromId, candidate));
      return;
    }

    const pc = this.peers.get(fromId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error(`🎤 Failed to add ICE from ${fromId}:`, err);
      }
    } else {
      if (!this.iceCandidateBuffer.has(fromId)) {
        this.iceCandidateBuffer.set(fromId, []);
      }
      this.iceCandidateBuffer.get(fromId).push(candidate);
    }
  }

  async setupRemoteAudio(peerId, stream) {
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      console.log(`🎤 AudioContext suspended, resuming before setup...`);
      await this.audioContext.resume();
      console.log(`🎤 AudioContext state after resume: ${this.audioContext.state}`);
    }

    // Clean up existing
    if (this.gainNodes.has(peerId)) {
      this.gainNodes.delete(peerId);
      this.analysers.delete(peerId);
    }
    const existingAudio = this.audioElements.get(peerId);
    if (existingAudio) {
      existingAudio.pause();
      existingAudio.srcObject = null;
      this.audioElements.delete(peerId);
    }

    const tracks = stream.getAudioTracks();
    console.log(`🎤 Setting up audio for ${peerId}: ${tracks.length} tracks, AudioContext: ${this.audioContext.state}`);
    tracks.forEach((t, i) => {
      console.log(`🎤   Track ${i}: enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`);
    });

    // *** FIX: Use HTML <audio> element for playback ***
    // Chrome has a known bug where createMediaStreamSource() from remote WebRTC
    // streams silently fails to decode audio through Web Audio API.
    // The <audio> element reliably handles WebRTC audio playback.
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = this.deafened ? 0 : MAX_VOLUME;
    try {
      await audio.play();
      console.log(`🎤 ✅ <audio> element playing for peer ${peerId}`);
    } catch (e) {
      console.warn(`🎤 Audio play failed for ${peerId}, will retry on user gesture:`, e.message);
    }
    this.audioElements.set(peerId, audio);

    // Web Audio API analyser for level metering only (NOT for playback)
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    // Do NOT connect to destination - the <audio> element handles playback

    this.analysers.set(peerId, analyser);

    console.log(`🎤 ✅ Audio pipeline ACTIVE for player ${peerId}, AudioContext: ${this.audioContext.state}`);
  }

  getLocalMicLevel() {
    if (!this.localAnalyser) return 0;
    const data = new Uint8Array(this.localAnalyser.frequencyBinCount);
    this.localAnalyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  updateProximity(myPosition, otherPlayers) {
    if (this.deafened) return;

    otherPlayers.forEach((player, playerId) => {
      const audio = this.audioElements.get(playerId);
      if (!audio) return;

      const dx = myPosition.x - player.targetPosition.x;
      const dy = myPosition.y - player.targetPosition.y;
      const dz = myPosition.z - player.targetPosition.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      let volume = 0;
      if (distance < VOICE_RANGE) {
        volume = Math.max(0, MAX_VOLUME * (1 - distance / VOICE_RANGE));
        volume = volume * volume;
      }

      audio.volume = Math.min(1, Math.max(0, volume));

      const indicator = document.getElementById(`voice-p-${playerId}`);
      if (indicator) {
        indicator.style.opacity = volume > 0.05 ? '1' : '0.3';
      }
    });
  }

  disconnectPeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }

    const audio = this.audioElements.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.audioElements.delete(peerId);
    }

    this.gainNodes.delete(peerId);
    this.analysers.delete(peerId);
    this.iceCandidateBuffer.delete(peerId);

    const indicator = document.getElementById(`voice-p-${peerId}`);
    if (indicator) indicator.classList.remove('connected');
  }

  addPlayerIndicator(playerId, username) {
    const container = document.getElementById('voice-players');
    if (document.getElementById(`voice-p-${playerId}`)) return;
    const el = document.createElement('div');
    el.id = `voice-p-${playerId}`;
    el.className = 'voice-player-indicator';
    el.textContent = `🔊 ${username}`;
    el.style.opacity = '0.3';
    container.appendChild(el);
  }

  removePlayerIndicator(playerId) {
    const el = document.getElementById(`voice-p-${playerId}`);
    if (el) el.remove();
  }

  startDebugLogging() {
    this.debugInterval = setInterval(async () => {
      const localLevel = this.getLocalMicLevel();
      const levelEl = document.getElementById('voice-local-level');
      if (levelEl) {
        const bars = '█'.repeat(Math.min(20, Math.floor(localLevel * 100)));
        levelEl.textContent = `MIC: ${bars} ${(localLevel * 100).toFixed(1)}`;
      }

      if (this.peers.size === 0) return;

      const lines = [`🎤 === Voice Debug ===`];
      lines.push(`  AudioContext: ${this.audioContext?.state}, Mic muted: ${this.muted}, Deafened: ${this.deafened}`);
      lines.push(`  Local mic level: ${(localLevel * 100).toFixed(1)}`);
      lines.push(`  Local tracks: ${this.localStream?.getAudioTracks().map(t => `enabled=${t.enabled} state=${t.readyState}`).join(', ')}`);

      for (const [peerId, pc] of this.peers) {
        lines.push(`  Peer ${peerId}: connection=${pc.connectionState} ice=${pc.iceConnectionState} signaling=${pc.signalingState}`);

        const senders = pc.getSenders();
        senders.forEach(s => {
          if (s.track) {
            lines.push(`    Sender: kind=${s.track.kind} enabled=${s.track.enabled} muted=${s.track.muted} state=${s.track.readyState}`);
          }
        });

        const receivers = pc.getReceivers();
        receivers.forEach(r => {
          if (r.track) {
            lines.push(`    Receiver: kind=${r.track.kind} enabled=${r.track.enabled} muted=${r.track.muted} state=${r.track.readyState}`);
          }
        });

        try {
          const stats = await pc.getStats();
          stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
              lines.push(`    INBOUND RTP: bytesReceived=${report.bytesReceived} packetsReceived=${report.packetsReceived} packetsLost=${report.packetsLost}`);
            }
            if (report.type === 'outbound-rtp' && report.kind === 'audio') {
              lines.push(`    OUTBOUND RTP: bytesSent=${report.bytesSent} packetsSent=${report.packetsSent}`);
            }
          });
        } catch (e) {}

        const analyser = this.analysers.get(peerId);
        if (analyser) {
          const freqData = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(freqData);
          const freqAvg = freqData.reduce((a, b) => a + b, 0) / freqData.length;

          const timeData = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteTimeDomainData(timeData);
          let rms = 0;
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            rms += v * v;
          }
          rms = Math.sqrt(rms / timeData.length);

          lines.push(`    Audio: freqAvg=${freqAvg.toFixed(1)} rms=${(rms * 100).toFixed(1)}`);
        }

        const audioEl = this.audioElements.get(peerId);
        if (audioEl) {
          lines.push(`    Volume: ${audioEl.volume.toFixed(3)} paused=${audioEl.paused}`);
        }
      }

      console.log(lines.join('\n'));
    }, 3000);
  }

  destroy() {
    if (this.debugInterval) clearInterval(this.debugInterval);
    this.peers.forEach(pc => pc.close());
    this.peers.clear();
    this.audioElements.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
    });
    this.audioElements.clear();
    this.gainNodes.clear();
    this.analysers.clear();
    this.iceCandidateBuffer.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
