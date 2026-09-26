// Talks to Supabase through the studio_* functions in supabase/studio.sql. The key from the private
// link rides along with every call, and each function checks it before doing anything.
import config from './config.js';

export class StudioError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function rpc(name, body) {
  let res;
  try {
    res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new StudioError("Couldn't reach the studio. Check your internet and try again.", 0);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) throw new StudioError(data?.message || `Something went wrong (${res.status}).`, res.status);
  return data;
}

const online = (key) => ({
  hello: () => rpc('studio_hello', { key }),
  list: () => rpc('studio_list', { key }),
  get: (doodle) => rpc('studio_get', { key, doodle }),
  save: ({ id = null, name, strokes, image, thumb }) =>
    rpc('studio_save', { key, doodle: id, name, strokes, image, thumb }),
  remove: (doodle) => rpc('studio_delete', { key, doodle }),
  assign: (doodle, spot) => rpc('studio_assign', { key, doodle, spot }),
});

// Practice mode for trying the studio on this computer (npm run studio, then open #key=local, or
// #key=local-artist to see what an artist sees). Doodles stay in this browser only. The live
// studio never turns this on.
const LOCAL_STORE = 'studio-local-doodles';
const local = (owner) => {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_STORE) || '[]');
    } catch {
      return [];
    }
  };
  const write = (all) => localStorage.setItem(LOCAL_STORE, JSON.stringify(all));
  return {
    hello: async () => ({ label: 'Practice', practice: true, owner }),
    list: async () =>
      read()
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map(({ id, name, spot = null, thumb, updated_at }) => ({ id, name, artist: 'Practice', spot, thumb, updated_at })),
    get: async (id) => {
      const found = read().find((d) => d.id === id);
      if (!found) throw new StudioError("That doodle couldn't be found.", 400);
      return found;
    },
    save: async ({ id, name, strokes, image, thumb }) => {
      const all = read();
      const updated_at = new Date().toISOString();
      const existing = id && all.find((d) => d.id === id);
      if (existing) Object.assign(existing, { name, strokes, image, thumb, updated_at });
      else all.push({ id: (id = crypto.randomUUID()), name, strokes, image, thumb, updated_at });
      write(all);
      return id;
    },
    remove: async (id) => write(read().filter((d) => d.id !== id)),
    assign: async (id, spot) => write(read().map((d) => (d.id === id ? { ...d, spot: spot || null } : d))),
  };
};

export const connect = (key) =>
  config.local && (key === 'local' || key === 'local-artist') ? local(key === 'local') : online(key);
