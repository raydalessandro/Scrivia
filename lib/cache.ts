// Cache minimale per i comandi puri (read/derive). Stessa filosofia del motore:
// "stesso input → stesso output, niente lavoro due volte". Quando i comandi
// diventeranno una MCP, questa cache vive lato server allo stesso modo.

type Entry = { value: unknown; at: number };

const store = new Map<string, Entry>();
const MAX = 200;
const TTL = 5 * 60 * 1000; // 5 min

export function cacheKey(parts: unknown[]): string {
  return parts.map((p) => (typeof p === "object" ? JSON.stringify(p) : String(p))).join("|");
}

/** Ritorna [valore, hit?]. Calcola e memorizza al miss. */
export function memo<T>(key: string, compute: () => T): [T, boolean] {
  const e = store.get(key);
  if (e && Date.now() - e.at < TTL) {
    store.delete(key);
    store.set(key, e); // LRU touch
    return [e.value as T, true];
  }
  const value = compute();
  store.set(key, { value, at: Date.now() });
  if (store.size > MAX) store.delete(store.keys().next().value!);
  return [value, false];
}

/** Invalida tutte le voci che iniziano col prefisso (es. una storia cambiata). */
export function invalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
