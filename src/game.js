import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { sounds } from './audio.js';

const ARENA = 60;
const FOOD_COLORS = { carrot: 0xff7f27, banana: 0xffe135, broccoli: 0x2f9e44, tomato: 0xe03131, cheese: 0xffd43b };
const RIFLE_FIRE_INTERVAL = 0.12; // seconds between shots while holding LMB
const RIFLE_DAMAGE = 12;
const KNIFE_DAMAGE = 40;
const KNIFE_RANGE = 3;
const KNIFE_COOLDOWN = 0.45;

export class Game {
  constructor({ container, playerFood, onScoreChange, onHealthChange, onWeaponChange, onDeath, onShot }) {
    this.onScoreChange = onScoreChange;
    this.onHealthChange = onHealthChange;
    this.onWeaponChange = onWeaponChange;
    this.onDeath = onDeath;
    this.onShot = onShot;
    this.playerFood = playerFood;

    this.score = 0;
    this.kills = 0;
    this.health = 100;
    this.weapon = 'rifle';
    this.firing = false;
    this.fireTimer = 0;
    this.knifeTimer = 0;
    this.dead = false;

    this.fridges = [];
    this.remotePlayers = new Map();
    this.keys = {};

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d6);
    this.scene.fog = new THREE.Fog(0x87b5d6, 40, 120);

    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300);
    this.camera.position.set(0, 1.6, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.scene.add(this.controls.getObject());

    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    this.#buildWorld();
    this.#buildViewModels();
    this.#bindInput();

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    for (let i = 0; i < 6; i++) this.spawnFridge();

    this.running = true;
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  // ---------- world ----------
  #buildWorld() {
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(20, 40, 10);
    this.scene.add(sun, new THREE.AmbientLight(0xbfd4e6, 0.8));

    // Kitchen tile floor
    const tileTex = this.#checkerTexture();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
      new THREE.MeshStandardMaterial({ map: tileTex })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Counter-top walls around the arena
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8 });
    for (const [x, z, w, d] of [
      [0, -ARENA, ARENA * 2, 2], [0, ARENA, ARENA * 2, 2],
      [-ARENA, 0, 2, ARENA * 2], [ARENA, 0, 2, ARENA * 2],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), wallMat);
      wall.position.set(x, 3, z);
      this.scene.add(wall);
    }

    // Scatter giant food props for cover
    const props = [
      () => new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4, 12), new THREE.MeshStandardMaterial({ color: 0xff7f27 })),
      () => new THREE.Mesh(new THREE.SphereGeometry(2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe03131 })),
      () => new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0xffd43b })),
    ];
    for (let i = 0; i < 14; i++) {
      const prop = props[i % props.length]();
      prop.position.set((Math.random() - 0.5) * ARENA * 1.6, 1.5, (Math.random() - 0.5) * ARENA * 1.6);
      if (prop.position.length() < 8) prop.position.setLength(12);
      this.scene.add(prop);
    }
  }

  #checkerTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#e8e4dc' : '#b8c4cc';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    return tex;
  }

  #buildViewModels() {
    // Baguette rifle
    this.rifleModel = new THREE.Group();
    const bread = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.06, 0.55, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0xc68e4c })
    );
    bread.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b }));
    tip.position.z = -0.38;
    this.rifleModel.add(bread, tip);
    this.rifleModel.position.set(0.28, -0.22, -0.55);
    this.camera.add(this.rifleModel);

    // Butter knife
    this.knifeModel = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.4), new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.8, roughness: 0.2 }));
    blade.position.z = -0.25;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
    this.knifeModel.add(blade, handle);
    this.knifeModel.position.set(0.28, -0.24, -0.45);
    this.knifeModel.visible = false;
    this.camera.add(this.knifeModel);

    // Muzzle flash
    this.flash = new THREE.PointLight(0xffcc66, 0, 4);
    this.flash.position.set(0.28, -0.18, -1);
    this.camera.add(this.flash);
  }

  // ---------- fridges ----------
  spawnFridge() {
    const fridge = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f3f5, metalness: 0.4, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 1.4), bodyMat);
    body.position.y = 1.6;
    const doorSeam = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.05, 1.42), new THREE.MeshStandardMaterial({ color: 0x999 }));
    doorSeam.position.y = 2.2;
    const handle1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), new THREE.MeshStandardMaterial({ color: 0x777 }));
    handle1.position.set(0.6, 2.7, 0.74);
    const handle2 = handle1.clone();
    handle2.position.y = 1.6;
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 });
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
    eye1.position.set(-0.35, 2.85, 0.72);
    const eye2 = eye1.clone();
    eye2.position.x = 0.05;
    fridge.add(body, doorSeam, handle1, handle2, eye1, eye2);

    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * (ARENA - 25);
    fridge.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    fridge.userData = { hp: 60, speed: 2 + Math.random() * 1.5, attackTimer: 0, isFridge: true };
    this.scene.add(fridge);
    this.fridges.push(fridge);
  }

  #updateFridges(dt) {
    const playerPos = this.controls.getObject().position;
    for (const f of this.fridges) {
      const dir = playerPos.clone().sub(f.position);
      dir.y = 0;
      const dist = dir.length();
      dir.normalize();
      if (dist > 2.2) f.position.addScaledVector(dir, f.userData.speed * dt);
      f.lookAt(playerPos.x, 0, playerPos.z);
      // waddle
      f.rotation.z = Math.sin(performance.now() / 150 + f.id) * 0.06;
      f.userData.attackTimer -= dt;
      if (dist <= 2.4 && f.userData.attackTimer <= 0 && !this.dead) {
        f.userData.attackTimer = 1;
        this.#damagePlayer(10);
      }
    }
  }

  #damagePlayer(amount) {
    this.health = Math.max(0, this.health - amount);
    sounds.hurt();
    this.onHealthChange(this.health);
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.onDeath();
      setTimeout(() => this.respawn(), 2500);
    }
  }

  respawn() {
    this.health = 100;
    this.dead = false;
    this.controls.getObject().position.set((Math.random() - 0.5) * 20, 1.6, (Math.random() - 0.5) * 20);
    this.onHealthChange(this.health);
    sounds.respawn();
  }

  #damageFridge(fridge, dmg) {
    fridge.userData.hp -= dmg;
    sounds.hit();
    if (fridge.userData.hp <= 0) {
      sounds.fridgeDie();
      this.scene.remove(fridge);
      this.fridges.splice(this.fridges.indexOf(fridge), 1);
      this.kills += 1;
      this.score += 100;
      this.onScoreChange(this.score, this.kills);
      setTimeout(() => this.running && this.spawnFridge(), 1500 + Math.random() * 2000);
      if (this.fridges.length < 4) this.spawnFridge();
    }
  }

  // ---------- weapons ----------
  setWeapon(w) {
    if (this.weapon === w) return;
    this.weapon = w;
    this.rifleModel.visible = w === 'rifle';
    this.knifeModel.visible = w === 'knife';
    sounds.swap();
    this.onWeaponChange(w);
  }

  #fireRifle() {
    sounds.shoot();
    this.flash.intensity = 3;
    setTimeout(() => (this.flash.intensity = 0), 40);
    this.rifleModel.position.z = -0.48; // recoil
    this.onShot?.({ weapon: 'rifle' });

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.fridges, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !obj.userData.isFridge) obj = obj.parent;
      if (obj) this.#damageFridge(obj, RIFLE_DAMAGE);
    }
  }

  #swingKnife() {
    sounds.knife();
    this.knifeModel.rotation.x = -0.9;
    setTimeout(() => (this.knifeModel.rotation.x = 0), 150);
    this.onShot?.({ weapon: 'knife' });

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.fridges, true);
    if (hits.length && hits[0].distance <= KNIFE_RANGE) {
      let obj = hits[0].object;
      while (obj && !obj.userData.isFridge) obj = obj.parent;
      if (obj) this.#damageFridge(obj, KNIFE_DAMAGE);
    }
  }

  // ---------- remote players ----------
  updateRemotePlayer(state) {
    let mesh = this.remotePlayers.get(state.id);
    if (!mesh) {
      const color = FOOD_COLORS[state.food] ?? 0xffffff;
      mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.9, 6, 12), new THREE.MeshStandardMaterial({ color }));
      body.position.y = 0.9;
      const label = this.#nameSprite(state.name);
      label.position.y = 2.3;
      mesh.add(body, label);
      this.scene.add(mesh);
      this.remotePlayers.set(state.id, mesh);
    }
    mesh.position.set(state.x, 0, state.z);
    mesh.rotation.y = state.ry ?? 0;
    mesh.userData.lastSeen = performance.now();
  }

  removeStalePlayers(activeIds) {
    for (const [id, mesh] of this.remotePlayers) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.remotePlayers.delete(id);
      }
    }
  }

  #nameSprite(name) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 32px sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.strokeStyle = '#000';
    g.lineWidth = 5;
    g.strokeText(name, 128, 42);
    g.fillText(name, 128, 42);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  getState() {
    const p = this.controls.getObject().position;
    return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), ry: +this.camera.rotation.y.toFixed(2) };
  }

  // ---------- input ----------
  #bindInput() {
    this.onKeyDown = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      this.keys[e.code] = true;
      if (e.code === 'Digit1') this.setWeapon('rifle');
      if (e.code === 'Digit2') this.setWeapon('knife');
      if (e.code === 'KeyQ') this.setWeapon(this.weapon === 'rifle' ? 'knife' : 'rifle');
    };
    this.onKeyUp = (e) => (this.keys[e.code] = false);
    this.onMouseDown = (e) => {
      if (e.button === 0 && this.controls.isLocked) this.firing = true;
    };
    this.onMouseUp = (e) => {
      if (e.button === 0) this.firing = false;
    };
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  // ---------- loop ----------
  #tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.controls.isLocked && !this.dead) {
      const speed = 8;
      const forward = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
      const right = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
      this.controls.moveForward(forward * speed * dt);
      this.controls.moveRight(right * speed * dt);
      const p = this.controls.getObject().position;
      p.x = THREE.MathUtils.clamp(p.x, -ARENA + 2, ARENA - 2);
      p.z = THREE.MathUtils.clamp(p.z, -ARENA + 2, ARENA - 2);
      p.y = 1.6;

      // Continuous fire while holding LMB
      this.fireTimer -= dt;
      this.knifeTimer -= dt;
      if (this.firing) {
        if (this.weapon === 'rifle' && this.fireTimer <= 0) {
          this.fireTimer = RIFLE_FIRE_INTERVAL;
          this.#fireRifle();
        } else if (this.weapon === 'knife' && this.knifeTimer <= 0) {
          this.knifeTimer = KNIFE_COOLDOWN;
          this.#swingKnife();
        }
      }
      // rifle recoil recovery
      this.rifleModel.position.z += (-0.55 - this.rifleModel.position.z) * 10 * dt;

      this.#updateFridges(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.controls.unlock();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
