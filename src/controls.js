import * as THREE from 'three';
import { GameConfig } from './config.js';

export class PlayerControls {
  constructor(camera, domElement, worldGenerator) {
    this.camera = camera;
    this.domElement = domElement;
    this.worldGenerator = worldGenerator;

    this.lookSpeed = 0.002;
    this.flySpeed = GameConfig.player.flySpeed;

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;
    this.moveDown = false;

    this.playerHeight = GameConfig.player.height;
    this.playerRadius = GameConfig.player.radius;
    this.stepHeight = GameConfig.player.stepHeight;

    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.PI_2 = Math.PI / 2;

    this.isLocked = false;

    this.init();
  }

  init() {
    this.domElement.addEventListener('click', () => {
      this.domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener('mousemove', (event) => {
      if (!this.isLocked) return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= movementX * this.lookSpeed;
      this.euler.x -= movementY * this.lookSpeed;
      this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x));

      this.camera.quaternion.setFromEuler(this.euler);
    });

    document.addEventListener('keydown', (event) => this.onKeyDown(event));
    document.addEventListener('keyup', (event) => this.onKeyUp(event));
  }

  onKeyDown(event) {
    switch (event.code) {
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'KeyD':
        this.moveRight = true;
        break;
      case 'Space':
        this.moveUp = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.moveDown = true;
        break;
    }
  }



  onKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'KeyD':
        this.moveRight = false;
        break;
      case 'Space':
        this.moveUp = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.moveDown = false;
        break;
    }
  }

  checkCollision(newPosition) {
    const feetY = newPosition.y - this.playerHeight;
    const headY = newPosition.y;

    const checkPoints = [
      // Feet level - check right at the feet, not 0.1 above
      { x: newPosition.x, y: feetY + 0.01, z: newPosition.z },
      // Head level
      { x: newPosition.x, y: headY - 0.1, z: newPosition.z },
      // Body at multiple radii - mid body
      { x: newPosition.x + this.playerRadius, y: newPosition.y - 0.5, z: newPosition.z },
      { x: newPosition.x - this.playerRadius, y: newPosition.y - 0.5, z: newPosition.z },
      { x: newPosition.x, y: newPosition.y - 0.5, z: newPosition.z + this.playerRadius },
      { x: newPosition.x, y: newPosition.y - 0.5, z: newPosition.z - this.playerRadius },
      // Feet at radius (standing on edges)
      { x: newPosition.x + this.playerRadius * 0.7, y: feetY + 0.01, z: newPosition.z + this.playerRadius * 0.7 },
      { x: newPosition.x - this.playerRadius * 0.7, y: feetY + 0.01, z: newPosition.z - this.playerRadius * 0.7 },
      { x: newPosition.x + this.playerRadius * 0.7, y: feetY + 0.01, z: newPosition.z - this.playerRadius * 0.7 },
      { x: newPosition.x - this.playerRadius * 0.7, y: feetY + 0.01, z: newPosition.z + this.playerRadius * 0.7 }
    ];

    for (const pos of checkPoints) {
      const block = this.worldGenerator.getBlockAt(
        Math.floor(pos.x),
        Math.floor(pos.y),
        Math.floor(pos.z)
      );
      if (block) {
        return true;
      }
    }
    return false;
  }

  isStuckInBlock() {
    const pos = this.camera.position;
    const feetY = pos.y - this.playerHeight;
    const bodyPoints = [
      { x: pos.x, y: feetY + 0.2, z: pos.z },
      { x: pos.x, y: pos.y - 0.5, z: pos.z },
      { x: pos.x, y: pos.y - 0.1, z: pos.z }
    ];
    for (const p of bodyPoints) {
      if (this.worldGenerator.getBlockAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) {
        return true;
      }
    }
    return false;
  }

  resolveStuck() {
    const pos = this.camera.position;
    for (let dy = 0; dy <= 10; dy++) {
      const testPos = pos.clone();
      testPos.y += dy;
      if (!this.checkCollision(testPos)) {
        this.camera.position.y = testPos.y;
        this.velocity.y = 0;
        return;
      }
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      for (let dy = 0; dy <= 10; dy++) {
        const testPos = pos.clone();
        testPos.x += dx;
        testPos.y += dy;
        testPos.z += dz;
        if (!this.checkCollision(testPos)) {
          this.camera.position.copy(testPos);
          this.velocity.y = 0;
          return;
        }
      }
    }
  }



  update(deltaTime = 1 / 60) {
    if (!this.isLocked) return;

    if (this.isStuckInBlock()) {
      this.resolveStuck();
    }

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    right.crossVectors(forward, this.camera.up).normalize();

    const moveVector = new THREE.Vector3();

    if (this.moveForward) moveVector.add(forward.clone().multiplyScalar(this.flySpeed * deltaTime));
    if (this.moveBackward) moveVector.add(forward.clone().multiplyScalar(-this.flySpeed * deltaTime));
    if (this.moveLeft) moveVector.add(right.clone().multiplyScalar(-this.flySpeed * deltaTime));
    if (this.moveRight) moveVector.add(right.clone().multiplyScalar(this.flySpeed * deltaTime));
    if (this.moveUp) moveVector.y += this.flySpeed * deltaTime;
    if (this.moveDown) moveVector.y -= this.flySpeed * deltaTime;

    const newPos = this.camera.position.clone();
    newPos.add(moveVector);

    if (!this.checkCollision(newPos)) {
      this.camera.position.copy(newPos);
    } else {
      const newPosX = this.camera.position.clone();
      newPosX.x += moveVector.x;
      if (!this.checkCollision(newPosX)) {
        this.camera.position.x = newPosX.x;
      }

      const newPosY = this.camera.position.clone();
      newPosY.y += moveVector.y;
      if (!this.checkCollision(newPosY)) {
        this.camera.position.y = newPosY.y;
      }

      const newPosZ = this.camera.position.clone();
      newPosZ.z += moveVector.z;
      if (!this.checkCollision(newPosZ)) {
        this.camera.position.z = newPosZ.z;
      }
    }

    // Push camera away from nearby block faces to prevent near-plane clipping
    const camPos = this.camera.position;
    const buffer = 0.35;
    const checkDirs = [
      { axis: 'x', dir: 1 },
      { axis: 'x', dir: -1 },
      { axis: 'y', dir: 1 },
      { axis: 'y', dir: -1 },
      { axis: 'z', dir: 1 },
      { axis: 'z', dir: -1 }
    ];

    for (const { axis, dir } of checkDirs) {
      const probePos = { x: camPos.x, y: camPos.y, z: camPos.z };
      probePos[axis] += dir * buffer;
      const block = this.worldGenerator.getBlockAt(
        Math.floor(probePos.x),
        Math.floor(probePos.y),
        Math.floor(probePos.z)
      );
      if (block) {
        const blockCoord = Math.floor(probePos[axis]);
        if (dir > 0) {
          camPos[axis] = Math.min(camPos[axis], blockCoord - buffer);
        } else {
          camPos[axis] = Math.max(camPos[axis], blockCoord + 1 + buffer);
        }
      }
    }
  }
}
