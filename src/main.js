import { Game } from './game.js';
import { sounds } from './audio.js';
import {
  supabaseEnabled, listServers, createServer,
  loadSave, saveGame, fetchLeaderboard, joinRoom,
} from './net.js';

const $ = (id) => document.getElementById(id);
const menu = $('menu'), hud = $('hud'), leaderboardEl = $('leaderboard'), clickToPlay = $('clickToPlay');

let game = null;
let room = null;
let save = { total_kills: 0, best_score: 0 };
let me = null;
let stateInterval = null;
let saveInterval = null;

// ---------- menu ----------
async function refreshServers() {
  const list = $('serverList');
  try {
    const servers = await listServers();
    list.innerHTML = '';
    if (!servers.length) list.innerHTML = '<em>No servers yet — create one!</em>';
    for (const s of servers) {
      const row = document.createElement('div');
      row.className = 'server-row';
      const name = document.createElement('span');
      name.textContent = s.name;
      const btn = document.createElement('button');
      btn.className = 'join-btn';
      btn.textContent = 'Join';
      btn.onclick = () => startGame(s);
      row.append(name, btn);
      list.appendChild(row);
    }
  } catch (err) {
    list.innerHTML = '<em>Failed to load servers</em>';
    console.error(err);
  }
}

$('createServerBtn').onclick = async () => {
  const name = $('newServerName').value.trim();
  if (!name) return setStatus('Enter a server name first.');
  try {
    await createServer(name);
    $('newServerName').value = '';
    refreshServers();
  } catch (err) {
    setStatus('Could not create server: ' + err.message);
  }
};

$('leaderboardBtn').onclick = async () => {
  menu.classList.add('hidden');
  leaderboardEl.classList.remove('hidden');
  const tbody = leaderboardEl.querySelector('tbody');
  tbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
  try {
    const rows = await fetchLeaderboard();
    tbody.innerHTML = rows.length ? '' : '<tr><td colspan="4">No scores yet</td></tr>';
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      for (const v of [i + 1, r.player_name, r.total_kills, r.best_score]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4">Failed to load leaderboard</td></tr>';
    console.error(err);
  }
};
$('closeLeaderboardBtn').onclick = () => {
  leaderboardEl.classList.add('hidden');
  menu.classList.remove('hidden');
};

function setStatus(msg) { $('menuStatus').textContent = msg; }

// ---------- game start / stop ----------
async function startGame(server) {
  const name = $('playerName').value.trim();
  if (!name) return setStatus('Enter a player name first.');
  const food = $('playerFood').value;
  me = { id: crypto.randomUUID(), name, food };

  // Cloud save (never stored locally)
  try {
    const existing = await loadSave(name);
    if (existing) save = existing;
    else await saveGame(name, { food, total_kills: 0, best_score: 0 });
  } catch (err) { console.error('save load failed', err); }

  menu.classList.add('hidden');
  hud.classList.remove('hidden');

  game = new Game({
    container: document.body,
    playerFood: food,
    onScoreChange: (score, kills) => {
      $('score').textContent = `Score: ${score}`;
      $('kills').textContent = `🧊 Fridges: ${kills}`;
    },
    onHealthChange: (hp) => {
      $('health').textContent = `❤️ ${hp}`;
      if (hp > 0) $('deathScreen').classList.add('hidden');
    },
    onWeaponChange: (w) => {
      $('weapon').textContent = w === 'rifle' ? '🔫 Baguette Rifle' : '🔪 Butter Knife';
    },
    onDeath: () => $('deathScreen').classList.remove('hidden'),
    onShot: () => {},
  });

  room = joinRoom(server.id, me, {
    onPlayers: (players) => {
      $('players-online').innerHTML =
        `<b>${server.name}</b> — ${players.length} online<br>` +
        players.map((p) => `${p.name}`).join('<br>');
      game?.removeStalePlayers(new Set(players.map((p) => p.id)));
    },
    onRemoteState: (state) => { if (state.id !== me.id) game?.updateRemotePlayer(state); },
    onChat: (msg) => addChatMessage(msg),
    onRemoteShot: () => sounds.shoot(),
  });

  stateInterval = setInterval(() => {
    if (game && room) room.sendState(game.getState());
  }, 100);

  // Periodic cloud save
  saveInterval = setInterval(persistProgress, 10000);

  clickToPlay.classList.remove('hidden');
}

function persistProgress() {
  if (!game || !me) return;
  save.total_kills = (save.total_kills ?? 0) + game.kills;
  save.best_score = Math.max(save.best_score ?? 0, game.score);
  game.kills = 0; // counted into save
  const shown = save.total_kills;
  $('kills').textContent = `🧊 Fridges: ${shown}`;
  saveGame(me.name, { food: me.food, total_kills: save.total_kills, best_score: save.best_score });
}

$('quitBtn').onclick = async () => {
  persistProgress();
  clearInterval(stateInterval);
  clearInterval(saveInterval);
  await room?.leave();
  room = null;
  game?.dispose();
  game = null;
  hud.classList.add('hidden');
  clickToPlay.classList.add('hidden');
  $('chatMessages').innerHTML = '';
  menu.classList.remove('hidden');
  refreshServers();
};

// Pointer lock flow
clickToPlay.addEventListener('click', () => game?.controls.lock());
document.addEventListener('pointerlockchange', () => {
  if (!game) return;
  if (document.pointerLockElement) clickToPlay.classList.add('hidden');
  else if (!hud.classList.contains('hidden') && document.activeElement !== $('chatInput')) {
    clickToPlay.classList.remove('hidden');
  }
});

// ---------- chat ----------
const chatInput = $('chatInput');
function addChatMessage({ name, text }) {
  const div = document.createElement('div');
  div.className = 'msg';
  const b = document.createElement('b');
  b.textContent = name + ': ';
  div.appendChild(b);
  div.appendChild(document.createTextNode(text));
  const box = $('chatMessages');
  box.appendChild(div);
  while (box.children.length > 30) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
  sounds.chat();
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !game) return;
  if (document.activeElement === chatInput) {
    const text = chatInput.value.trim();
    if (text && room) {
      const msg = room.sendChat(text);
      addChatMessage(msg);
    }
    chatInput.value = '';
    chatInput.classList.add('hidden');
    chatInput.blur();
    game.controls.lock();
  } else {
    chatInput.classList.remove('hidden');
    game.controls.unlock();
    setTimeout(() => chatInput.focus(), 50);
  }
});

// ---------- boot ----------
if (!supabaseEnabled) {
  setStatus('⚠️ Supabase not configured — online features disabled. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}
refreshServers();
