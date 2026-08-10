import { supabase, supabaseEnabled } from './supabaseClient.js';

export { supabaseEnabled };

// ---------- Servers ----------
export async function listServers() {
  if (!supabaseEnabled) return [{ id: 'offline', name: 'Offline (no Supabase configured)' }];
  const { data, error } = await supabase.from('servers').select('id, name').order('created_at');
  if (error) throw error;
  return data;
}

export async function createServer(name) {
  if (!supabaseEnabled) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('servers').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

// ---------- Save files (cloud only, never local) ----------
export async function loadSave(playerName) {
  if (!supabaseEnabled) return null;
  const { data, error } = await supabase
    .from('player_saves').select('*').eq('player_name', playerName).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveGame(playerName, { food, total_kills, best_score }) {
  if (!supabaseEnabled) return;
  const { error } = await supabase.from('player_saves').upsert(
    { player_name: playerName, food, total_kills, best_score, updated_at: new Date().toISOString() },
    { onConflict: 'player_name' }
  );
  if (error) console.error('saveGame failed', error);
}

// ---------- Leaderboard ----------
export async function fetchLeaderboard() {
  if (!supabaseEnabled) return [];
  const { data, error } = await supabase
    .from('player_saves')
    .select('player_name, total_kills, best_score')
    .order('total_kills', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

// ---------- Realtime room (multiplayer + chat) ----------
export function joinRoom(serverId, me, handlers) {
  if (!supabaseEnabled) {
    return {
      sendState() {}, sendChat() {}, sendShot() {}, sendFridgeKill() {},
      async leave() {},
    };
  }
  const channel = supabase.channel(`room:${serverId}`, {
    config: { presence: { key: me.id }, broadcast: { self: false } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const players = Object.values(state).flat();
      handlers.onPlayers?.(players);
    })
    .on('broadcast', { event: 'state' }, ({ payload }) => handlers.onRemoteState?.(payload))
    .on('broadcast', { event: 'chat' }, ({ payload }) => handlers.onChat?.(payload))
    .on('broadcast', { event: 'shot' }, ({ payload }) => handlers.onRemoteShot?.(payload))
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ id: me.id, name: me.name, food: me.food });
        handlers.onConnected?.();
      }
    });

  return {
    sendState(state) {
      channel.send({ type: 'broadcast', event: 'state', payload: { id: me.id, name: me.name, food: me.food, ...state } });
    },
    sendChat(text) {
      const payload = { id: me.id, name: me.name, text, ts: Date.now() };
      channel.send({ type: 'broadcast', event: 'chat', payload });
      return payload;
    },
    sendShot(shot) {
      channel.send({ type: 'broadcast', event: 'shot', payload: { id: me.id, ...shot } });
    },
    async leave() {
      await channel.untrack();
      await supabase.removeChannel(channel);
    },
  };
}
