/**
 * FRIDGE FPS - Multiplayer 3D FPS
 * Theme: Players & guns = food, Enemies = refrigerators
 * Backend: Supabase (Auth + Postgres + Realtime Broadcast/Presence)
 *
 * IMPORTANT: Replace SUPABASE_URL and SUPABASE_ANON_KEY below with your free project values.
 * Free plan limits (~200 concurrent, ~100 msg/s) mean this is a prototype:
 * - Keep player count low (4-8)
 * - Position updates ~10-15 Hz
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createClient } from '@supabase/supabase-js';

// ========== CONFIG - REPLACE THESE ==========
const SUPABASE_URL = 'https://vyuzihzitumymivwrvpi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5dXppaHppdHVteW1pdndydnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTY0NjcsImV4cCI6MjEwMTkzMjQ2N30.jgV9iLZMT3KwYrEgYKDfZmIGmFAwBFOU4aYWCHih6-s';
// ============================================

const IS_CONFIGURED = !SUPABASE_URL.includes('https://vyuzihzitumymivwrvpi.supabase.co') && !SUPABASE_ANON_KEY.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5dXppaHppdHVteW1pdndydnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTY0NjcsImV4cCI6MjEwMTkzMjQ2N30.jgV9iLZMT3KwYrEgYKDfZmIGmFAwBFOU4aYWCHih6-s');

const supabase = IS_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ---------- Game State ----------
const state = {
  user: null,
  roomId: null,
  channel: null,
  players: new Map(),
  localId: null,
  score: 0,
  kills: 0,
  health: 100,
  inGame: false,
  isPaused: false,
  servers: [],
  chatOpen: false,
};

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const mainMenu = $('#main-menu');
const serverBrowser = $('#server-browser');
const leaderboardView = $('#leaderboard-view');
const profileView = $('#profile-view');
const pauseMenu = $('#pause-menu');
const hud = $('#hud');
const crosshair = $('#crosshair');
const chatPanel = $('#chat-panel');
const chatMessages = $('#chat-messages');
const chatInput = $('#chat-input');
const configWarning = $('#config-warning');

if (!IS_CONFIGURED) {
  configWarning.style.display = 'block';
}

// ---------- Three.js Scene ----------
let scene, camera, renderer, controls, clock;
let localPlayerMesh;
const projectiles = [];
const enemies = [];
const foodGun = { mesh: null, cooldown: 0 };

const PLAYER_SPEED = 12;
const JUMP_FORCE = 10;
const GRAVITY = -25;
const FIRE_RATE = 0.25;

let velocity = new THREE.Vector3();
let canJump = false;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b14);
  scene.fog = new THREE.Fog(0x0b0b14, 20, 80);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 1.6, 0);

  renderer = new THREE.WebGLRenderer({ canvas: $('#game-canvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xfff0e0, 1.1);
  dirLight.position.set(15, 30, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);

  const floorGeo = new THREE.PlaneGeometry(80, 80);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1e2e });
  const wallH = 6, wallT = 1, arena = 40;
  [[0, wallH/2, -arena], [0, wallH/2, arena], [-arena, wallH/2, 0], [arena, wallH/2, 0]].forEach((pos, i) => {
    const geo = new THREE.BoxGeometry(i < 2 ? 82 : wallT, wallH, i < 2 ? wallT : 82);
    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set(...pos);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
  });

  for (let i = 0; i < 12; i++) {
    const crate = createFoodCrate();
    crate.position.set((Math.random() - 0.5) * 60, 0.6, (Math.random() - 0.5) * 60);
    scene.add(crate);
  }

  localPlayerMesh = createFoodPlayer(0xfeca57);
  localPlayerMesh.visible = false;
  scene.add(localPlayerMesh);

  foodGun.mesh = createFoodGun();
  camera.add(foodGun.mesh);
  scene.add(camera);

  spawnFridges(8);

  controls = new PointerLockControls(camera, document.body);
  clock = new THREE.Clock();

  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && state.inGame && !state.isPaused) {
      pauseGame();
    }
  });
}

function createFoodPlayer(color = 0xff6b6b) {
  const group = new THREE.Group();
  const bunMat = new THREE.MeshStandardMaterial({ color: 0xe0a060, roughness: 0.3 });
  const pattyMat = new THREE.MeshStandardMaterial({ color: 0x5c3317 });
  const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.25, 16), bunMat);
  top.position.y = 1.3;
  const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 16), cheeseMat);
  cheese.position.y = 1.1;
  const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16), pattyMat);
  patty.position.y = 0.95;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 0.3, 16), bunMat);
  bottom.position.y = 0.7;
  const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), legMat);
  legL.position.set(-0.2, 0.25, 0);
  const legR = legL.clone();
  legR.position.x = 0.2;
  group.add(top, cheese, patty, bottom, legL, legR);
  return group;
}

function createFoodGun() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 12), mat);
  body.rotation.z = Math.PI / 2;
  body.position.set(0.35, -0.2, -0.5);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xe67e22 }));
  tip.rotation.z = -Math.PI / 2;
  tip.position.set(0.85, -0.2, -0.5);
  group.add(body, tip);
  return group;
}

function createFoodCrate() {
  const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createFridge() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.4, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xdfe6e9, metalness: 0.6, roughness: 0.3 })
  );
  body.position.y = 1.2;
  body.castShadow = true;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 2.2, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xb2bec3, metalness: 0.7 })
  );
  door.position.set(0, 1.2, 0.6);
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x2d3436 })
  );
  handle.position.set(0.5, 1.3, 0.7);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x880000 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
  eyeL.position.set(-0.3, 1.8, 0.65);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.3;
  group.add(body, door, handle, eyeL, eyeR);
  group.userData = { health: 50, type: 'fridge' };
  return group;
}

function spawnFridges(n) {
  for (let i = 0; i < n; i++) {
    const f = createFridge();
    f.position.set((Math.random() - 0.5) * 50, 0, (Math.random() - 0.5) * 50);
    if (f.position.length() < 8) f.position.setLength(10);
    scene.add(f);
    enemies.push(f);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(e) {
  switch (e.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyD': moveRight = true; break;
    case 'Space': if (canJump) { velocity.y = JUMP_FORCE; canJump = false; } break;
    case 'KeyT':
      if (state.inGame) {
        state.chatOpen = !state.chatOpen;
        chatPanel.classList.toggle('visible', state.chatOpen);
        if (state.chatOpen) {
          controls.unlock();
          chatInput.focus();
        } else {
          controls.lock();
        }
      }
      break;
    case 'Escape':
      if (state.inGame && !state.isPaused) pauseGame();
      else if (state.isPaused) resumeGame();
      break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyD': moveRight = false; break;
  }
}

function onMouseDown(e) {
  if (!state.inGame || state.isPaused || state.chatOpen) return;
  if (e.button === 0) shoot();
}

function shoot() {
  if (foodGun.cooldown > 0) return;
  foodGun.cooldown = FIRE_RATE;

  const geo = new THREE.SphereGeometry(0.12, 8, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc0392b, emissive: 0x4a0000 });
  const ball = new THREE.Mesh(geo, mat);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  ball.position.copy(camera.position).add(dir.clone().multiplyScalar(1.2));
  ball.userData = { velocity: dir.multiplyScalar(40), life: 2.5, owner: state.localId };
  scene.add(ball);
  projectiles.push(ball);

  if (state.channel) {
    state.channel.send({
      type: 'broadcast',
      event: 'shoot',
      payload: {
        id: state.localId,
        pos: ball.position.toArray(),
        dir: dir.toArray(),
        t: Date.now()
      }
    });
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state.inGame && !state.isPaused && controls.isLocked) {
    updateMovement(dt);
    updateProjectiles(dt);
    updateEnemies(dt);
    foodGun.cooldown = Math.max(0, foodGun.cooldown - dt);
    if (state.channel && Math.random() < 0.15) {
      broadcastPosition();
    }
  }

  renderer.render(scene, camera);
}

function updateMovement(dt) {
  velocity.x -= velocity.x * 8 * dt;
  velocity.z -= velocity.z * 8 * dt;
  velocity.y += GRAVITY * dt;

  const direction = new THREE.Vector3();
  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize();

  if (moveForward || moveBackward) velocity.z -= direction.z * PLAYER_SPEED * dt * 15;
  if (moveLeft || moveRight) velocity.x -= direction.x * PLAYER_SPEED * dt * 15;

  controls.moveRight(-velocity.x * dt);
  controls.moveForward(-velocity.z * dt);
  camera.position.y += velocity.y * dt;

  if (camera.position.y < 1.6) {
    velocity.y = 0;
    camera.position.y = 1.6;
    canJump = true;
  }

  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -38, 38);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -38, 38);

  localPlayerMesh.position.copy(camera.position);
  localPlayerMesh.position.y = 0;
  localPlayerMesh.rotation.y = camera.rotation.y;
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.position.addScaledVector(p.userData.velocity, dt);
    p.userData.life -= dt;
    if (p.userData.life <= 0 || p.position.y < 0) {
      scene.remove(p);
      projectiles.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (p.position.distanceTo(e.position) < 1.2) {
        e.userData.health -= 25;
        scene.remove(p);
        projectiles.splice(i, 1);
        if (e.userData.health <= 0) {
          scene.remove(e);
          enemies.splice(j, 1);
          state.score += 100;
          state.kills += 1;
          updateHUD();
          setTimeout(() => {
            if (!state.inGame) return;
            const nf = createFridge();
            nf.position.set((Math.random()-0.5)*50, 0, (Math.random()-0.5)*50);
            scene.add(nf);
            enemies.push(nf);
          }, 4000);
        }
        break;
      }
    }
  }
}

function updateEnemies(dt) {
  const playerPos = camera.position;
  enemies.forEach(e => {
    const dist = e.position.distanceTo(playerPos);
    if (dist < 25 && dist > 2) {
      const dir = playerPos.clone().sub(e.position).setY(0).normalize();
      e.position.addScaledVector(dir, 2.5 * dt);
      e.lookAt(playerPos.x, e.position.y, playerPos.z);
    }
    if (dist < 2.2) {
      state.health = Math.max(0, state.health - 15 * dt);
      updateHUD();
      if (state.health <= 0) onPlayerDeath();
    }
  });
}

function updateHUD() {
  $('#health-fill').style.width = state.health + '%';
  $('#health-text').textContent = Math.ceil(state.health) + ' HP';
  $('#score-text').textContent = 'Score: ' + state.score;
  $('#kills-text').textContent = 'Kills: ' + state.kills;
  $('#players-online').textContent = 'Players: ' + (state.players.size + 1);
  $('#server-name').textContent = 'Room: ' + (state.roomId || '—');
}

function onPlayerDeath() {
  state.health = 100;
  state.score = Math.max(0, state.score - 50);
  camera.position.set(0, 1.6, 0);
  velocity.set(0, 0, 0);
  updateHUD();
  savePlayerProgress();
}

async function initAuthUI() {
  if (!IS_CONFIGURED) {
    $('#btn-play-guest').onclick = () => startAsGuest();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    state.user = {
      id: session.user.id,
      display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Player',
      isGuest: false
    };
    showLoggedInMenu();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      state.user = {
        id: session.user.id,
        display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Player',
        isGuest: false
      };
      showLoggedInMenu();
    } else {
      state.user = null;
      showAuthMenu();
    }
  });

  $('#btn-play-guest').onclick = () => startAsGuest();
  $('#btn-login').onclick = login;
  $('#btn-signup').onclick = signup;
  $('#btn-logout').onclick = async () => {
    await supabase.auth.signOut();
    showAuthMenu();
  };
  $('#btn-join-server').onclick = openServerBrowser;
  $('#btn-leaderboard').onclick = openLeaderboard;
  $('#btn-profile').onclick = openProfile;
  $('#btn-back-servers').onclick = () => { serverBrowser.classList.add('hidden'); mainMenu.classList.remove('hidden'); };
  $('#btn-back-lb').onclick = () => { leaderboardView.classList.add('hidden'); mainMenu.classList.remove('hidden'); };
  $('#btn-back-profile').onclick = () => { profileView.classList.add('hidden'); mainMenu.classList.remove('hidden'); };
  $('#btn-create-server').onclick = createServer;
  $('#btn-resume').onclick = resumeGame;
  $('#btn-leave-server').onclick = leaveServer;

  $('#chat-send').onclick = sendChat;
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });
}

function showAuthMenu() {
  $('#auth-section').style.display = 'block';
  $('#menu-buttons').style.display = 'none';
  mainMenu.classList.remove('hidden');
}

function showLoggedInMenu() {
  $('#auth-section').style.display = 'none';
  $('#menu-buttons').style.display = 'block';
  mainMenu.classList.remove('hidden');
}

function startAsGuest() {
  const name = $('#player-name').value.trim() || 'Guest' + Math.floor(Math.random()*999);
  state.user = {
    id: 'guest_' + crypto.randomUUID().slice(0, 8),
    display_name: name,
    isGuest: true
  };
  state.localId = state.user.id;
  openServerBrowser();
}

async function login() {
  const email = $('#auth-email').value;
  const password = $('#auth-password').value;
  if (!email || !password) return alert('Enter email & password');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
}

async function signup() {
  const email = $('#auth-email').value;
  const password = $('#auth-password').value;
  const name = $('#player-name').value.trim() || email.split('@')[0];
  if (!email || !password) return alert('Enter email & password');
  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { display_name: name } }
  });
  if (error) alert(error.message);
  else alert('Check your email to confirm, or just login if confirmations are disabled.');
}

async function openServerBrowser() {
  mainMenu.classList.add('hidden');
  serverBrowser.classList.remove('hidden');
  await refreshServers();
}

async function refreshServers() {
  const list = $('#server-list');
  list.innerHTML = '<p class="loading">Loading...</p>';
  state.servers = [
    { id: 'kitchen-1', name: 'Kitchen Arena #1', players: '?', max: 8 },
    { id: 'kitchen-2', name: 'Kitchen Arena #2', players: '?', max: 8 },
    { id: 'freezer', name: 'Freezer Zone', players: '?', max: 6 },
    { id: 'pantry', name: 'Pantry Raid', players: '?', max: 10 }
  ];
  renderServerList();
}

function renderServerList() {
  const list = $('#server-list');
  list.innerHTML = '';
  state.servers.forEach(s => {
    const row = document.createElement('div');
    row.className = 'server-row';
    row.style.padding = '12px';
    row.style.borderBottom = '1px solid #333';
    row.innerHTML = `<strong>${s.name}</strong> <span style="color:#888">(${s.players}/${s.max})</span>`;
    row.onclick = () => joinServer(s.id, s.name);
    list.appendChild(row);
  });
}

async function createServer() {
  const name = prompt('Server name:', 'My Kitchen') || 'Custom Room';
  const id = 'custom-' + Date.now().toString(36);
  await joinServer(id, name);
}

async function joinServer(roomId, roomName) {
  state.roomId = roomId;
  state.localId = state.user.id;
  serverBrowser.classList.add('hidden');

  state.health = 100;
  state.score = 0;
  state.kills = 0;
  state.players.clear();
  camera.position.set(0, 1.6, 5);
  velocity.set(0,0,0);

  enemies.forEach(e => scene.remove(e));
  enemies.length = 0;
  projectiles.forEach(p => scene.remove(p));
  projectiles.length = 0;
  spawnFridges(6);

  if (IS_CONFIGURED && supabase) {
    if (state.channel) {
      await supabase.removeChannel(state.channel);
    }
    state.channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: state.localId }, broadcast: { self: false } }
    });

    state.channel
      .on('presence', { event: 'sync' }, () => {
        const presence = state.channel.presenceState();
        Object.keys(presence).forEach(id => {
          if (id === state.localId) return;
          const data = presence[id][0];
          ensureRemotePlayer(id, data);
        });
        state.players.forEach((_, id) => {
          if (!presence[id]) removeRemotePlayer(id);
        });
        updateHUD();
      })
      .on('broadcast', { event: 'pos' }, ({ payload }) => {
        if (payload.id === state.localId) return;
        updateRemotePlayer(payload);
      })
      .on('broadcast', { event: 'shoot' }, ({ payload }) => {
        if (payload.id === state.localId) return;
        spawnRemoteProjectile(payload);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        addChatMessage(payload.name, payload.text);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await state.channel.track({
            id: state.localId,
            name: state.user.display_name,
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            ry: camera.rotation.y
          });
        }
      });
  }

  state.inGame = true;
  state.isPaused = false;
  hud.classList.add('visible');
  crosshair.style.display = 'block';
  chatPanel.classList.add('visible');
  updateHUD();
  controls.lock();
}

function ensureRemotePlayer(id, data) {
  if (state.players.has(id)) return;
  const mesh = createFoodPlayer(0x48dbfb);
  mesh.position.set(data.x || 0, 0, data.z || 0);
  scene.add(mesh);
  state.players.set(id, { mesh, data });
}

function updateRemotePlayer(payload) {
  let p = state.players.get(payload.id);
  if (!p) {
    ensureRemotePlayer(payload.id, payload);
    p = state.players.get(payload.id);
  }
  if (p) {
    p.mesh.position.set(payload.x, 0, payload.z);
    p.mesh.rotation.y = payload.ry || 0;
  }
}

function removeRemotePlayer(id) {
  const p = state.players.get(id);
  if (p) {
    scene.remove(p.mesh);
    state.players.delete(id);
  }
}

function broadcastPosition() {
  if (!state.channel) return;
  state.channel.send({
    type: 'broadcast',
    event: 'pos',
    payload: {
      id: state.localId,
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      ry: camera.rotation.y
    }
  });
}

function spawnRemoteProjectile(payload) {
  const geo = new THREE.SphereGeometry(0.12, 8, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2980b9 });
  const ball = new THREE.Mesh(geo, mat);
  ball.position.fromArray(payload.pos);
  const dir = new THREE.Vector3().fromArray(payload.dir);
  ball.userData = { velocity: dir.multiplyScalar(40), life: 2.5, owner: payload.id };
  scene.add(ball);
  projectiles.push(ball);
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  const name = state.user?.display_name || 'Anon';
  addChatMessage(name, text);
  chatInput.value = '';
  if (state.channel) {
    state.channel.send({
      type: 'broadcast',
      event: 'chat',
      payload: { name, text, t: Date.now() }
    });
  }
}

function addChatMessage(name, text) {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="user">${escapeHtml(name)}:</span> ${escapeHtml(text)}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function openLeaderboard() {
  mainMenu.classList.add('hidden');
  leaderboardView.classList.remove('hidden');
  const body = $('#lb-body');
  body.innerHTML = '<tr><td colspan="4" class="loading">Loading...</td></tr>';

  if (!IS_CONFIGURED) {
    body.innerHTML = `
      <tr><td>1</td><td>DemoChef</td><td>12500</td><td>42</td></tr>
      <tr><td>2</td><td>FridgeSlayer</td><td>9800</td><td>31</td></tr>
      <tr><td>3</td><td>BurgerBoss</td><td>7200</td><td>22</td></tr>
      <tr><td colspan="4" style="color:#888;font-size:0.85rem">Configure Supabase to see live data</td></tr>
    `;
    return;
  }

  const { data, error } = await supabase
    .from('leaderboard')
    .select('display_name, score, kills')
    .order('score', { ascending: false })
    .limit(20);

  if (error) {
    body.innerHTML = `<tr><td colspan="4">Error: ${error.message}<br>Create table "leaderboard" (see README)</td></tr>`;
    return;
  }
  body.innerHTML = data.map((r, i) =>
    `<tr><td>${i+1}</td><td>${escapeHtml(r.display_name)}</td><td>${r.score}</td><td>${r.kills}</td></tr>`
  ).join('') || '<tr><td colspan="4">No scores yet</td></tr>';
}

async function openProfile() {
  mainMenu.classList.add('hidden');
  profileView.classList.remove('hidden');
  const content = $('#profile-content');
  if (!state.user || state.user.isGuest) {
    content.innerHTML = '<p>Guests do not have persistent cloud saves. Sign up to save progress online.</p>';
    return;
  }
  content.innerHTML = '<p class="loading">Loading...</p>';
  if (!IS_CONFIGURED) {
    content.innerHTML = '<p>Configure Supabase first.</p>';
    return;
  }
  const { data, error } = await supabase
    .from('player_saves')
    .select('*')
    .eq('user_id', state.user.id)
    .maybeSingle();
  if (error) {
    content.innerHTML = `<p>Error or table missing: ${error.message}</p>`;
    return;
  }
  if (!data) {
    content.innerHTML = `<p><strong>${state.user.display_name}</strong></p><p>No save yet. Play a match!</p>`;
  } else {
    content.innerHTML = `
      <p><strong>${escapeHtml(state.user.display_name)}</strong></p>
      <p>High Score: ${data.high_score || 0}</p>
      <p>Total Kills: ${data.total_kills || 0}</p>
      <p>Games Played: ${data.games_played || 0}</p>
      <p>Last Played: ${data.updated_at ? new Date(data.updated_at).toLocaleString() : '—'}</p>
    `;
  }
}

async function savePlayerProgress() {
  if (!IS_CONFIGURED || !state.user || state.user.isGuest) return;
  try {
    await supabase.from('player_saves').upsert({
      user_id: state.user.id,
      display_name: state.user.display_name,
      high_score: state.score,
      total_kills: state.kills,
      games_played: 1,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    await supabase.from('leaderboard').upsert({
      user_id: state.user.id,
      display_name: state.user.display_name,
      score: state.score,
      kills: state.kills,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } catch (e) {
    console.warn('Save failed', e);
  }
}

function pauseGame() {
  state.isPaused = true;
  controls.unlock();
  pauseMenu.classList.remove('hidden');
  savePlayerProgress();
}

function resumeGame() {
  state.isPaused = false;
  pauseMenu.classList.add('hidden');
  controls.lock();
}

async function leaveServer() {
  state.inGame = false;
  state.isPaused = false;
  pauseMenu.classList.add('hidden');
  hud.classList.remove('visible');
  crosshair.style.display = 'none';
  chatPanel.classList.remove('visible');
  controls.unlock();
  if (state.channel && supabase) {
    await supabase.removeChannel(state.channel);
    state.channel = null;
  }
  state.players.forEach(p => scene.remove(p.mesh));
  state.players.clear();
  savePlayerProgress();
  mainMenu.classList.remove('hidden');
  if (state.user && !state.user.isGuest) showLoggedInMenu();
  else showAuthMenu();
}

initThree();
initAuthUI();
animate();

console.log('%cFRIDGE FPS ready', 'color:#feca57;font-size:16px');
console.log('Configure SUPABASE_URL and SUPABASE_ANON_KEY in src/main.js for full online features.');
