// Remembers signed image links so that moving between screens (grid, listing, back) reuses the same URLs. The browser
// then serves the picture from its own cache instead of downloading it again, which matters on a free backend with a
// small monthly bandwidth allowance. Plain logic with no network or React: the signing call is passed in.

export interface SignedLink { path: string; url: string }

interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LinkCacheOptions {
  /** Signs a batch of storage paths. Objects that do not exist or may not be read come back with an empty url or not at all. */
  sign: (paths: string[]) => Promise<SignedLink[]>
  /** How long a freshly signed link stays valid. */
  lifetimeMs: number
  /** Stop reusing a link this long before it expires. */
  renewBeforeMs: number
  /** How long "no such object" is remembered, so a missing thumbnail is not asked about again by every card. */
  missingMs: number
  /** Where to keep links across page loads (localStorage). Any failure is ignored: links then just live in memory. */
  store?: KeyValueStore
  storeKey?: string
  now?: () => number
}

export function createLinkCache(options: LinkCacheOptions) {
  const { sign, lifetimeMs, renewBeforeMs, missingMs, store, storeKey = 'iiitd.photo-links.v1' } = options
  const now = options.now ?? Date.now
  const known = new Map<string, { url: string; until: number }>()
  const waiting = new Map<string, { promise: Promise<string>; settle: (url: string) => void }>()
  let queue: string[] = []

  if (store) {
    try {
      const saved: unknown = JSON.parse(store.getItem(storeKey) ?? '[]')
      if (Array.isArray(saved)) {
        for (const row of saved) {
          const [path, url, until] = Array.isArray(row) ? row : []
          if (typeof path === 'string' && typeof url === 'string' && url && typeof until === 'number' && until > now()) known.set(path, { url, until })
        }
      }
    } catch { /* unreadable or unavailable storage: start empty */ }
  }

  function save() {
    const t = now()
    for (const [path, entry] of known) if (entry.until <= t) known.delete(path)
    if (!store) return
    try {
      store.setItem(storeKey, JSON.stringify([...known].filter(([, entry]) => entry.url).map(([path, entry]) => [path, entry.url, entry.until])))
    } catch { /* storage full or blocked: links just are not kept across page loads */ }
  }

  // Everything asked for in the same moment (twelve cards mounting together) is signed in one request.
  async function flush() {
    const paths = queue
    queue = []
    let signed: SignedLink[] | null = null
    try { signed = await sign(paths) } catch { /* not remembered: the next screen asks again */ }
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.url]))
    const t = now()
    for (const path of paths) {
      const url = byPath.get(path) ?? ''
      if (signed) known.set(path, { url, until: t + (url ? lifetimeMs - renewBeforeMs : missingMs) })
      const entry = waiting.get(path)
      waiting.delete(path)
      entry?.settle(url)
    }
    save()
  }

  function link(path: string): Promise<string> {
    const hit = known.get(path)
    if (hit && hit.until > now()) return Promise.resolve(hit.url)
    const pending = waiting.get(path)
    if (pending) return pending.promise
    let settle: (url: string) => void = () => {}
    const promise = new Promise<string>((resolve) => { settle = resolve })
    waiting.set(path, { promise, settle })
    if (queue.length === 0) queueMicrotask(() => { void flush() })
    queue.push(path)
    return promise
  }

  return {
    /** One link per path, in order; an empty string means there is nothing to show. */
    links: (paths: string[]): Promise<string[]> => Promise.all(paths.map(link)),
    /** Forget everything, including what was kept across page loads (call on sign-out). */
    clear() {
      known.clear()
      try { store?.removeItem(storeKey) } catch { /* ignore */ }
    },
  }
}
