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
  /** Null disables signing/cache reads until access is confirmed. Empty string is an unscoped standalone cache. */
  scope?: string | null
}

export function createLinkCache(options: LinkCacheOptions) {
  const { sign, lifetimeMs, renewBeforeMs, missingMs, store, storeKey = 'iiitd.photo-links.v2' } = options
  const now = options.now ?? Date.now
  const known = new Map<string, { url: string; until: number }>()
  const waiting = new Map<string, { promise: Promise<string>; settle: (url: string) => void }>()
  let queue: string[] = []
  let generation = 0
  let scope = options.scope === undefined ? '' : options.scope

  // Unscoped links from the previous format cannot establish account ownership.
  if (storeKey === 'iiitd.photo-links.v2') {
    try { store?.removeItem('iiitd.photo-links.v1') } catch { /* storage may be blocked */ }
  }
  function restore() {
    if (!store || scope === null) return
    try {
      const saved = JSON.parse(store.getItem(storeKey) ?? 'null')
      if (saved?.scope === scope && Array.isArray(saved.rows)) {
        for (const row of saved.rows) {
          const [path, url, until] = Array.isArray(row) ? row : []
          if (typeof path === 'string' && typeof url === 'string' && url && typeof until === 'number' && until > now()) known.set(path, { url, until })
        }
      } else store.removeItem(storeKey)
    } catch { /* unreadable or unavailable storage: start empty */ }
  }
  restore()

  function save() {
    const t = now()
    for (const [path, entry] of known) if (entry.until <= t) known.delete(path)
    if (!store || scope === null) return
    try {
      store.setItem(storeKey, JSON.stringify({ scope, rows: [...known].filter(([, entry]) => entry.url).map(([path, entry]) => [path, entry.url, entry.until]) }))
    } catch { /* storage full or blocked: links just are not kept across page loads */ }
  }

  // Everything asked for in the same moment (twelve cards mounting together) is signed in one request.
  async function flush() {
    const request = generation
    const paths = queue
    queue = []
    if (!paths.length || scope === null) return
    let signed: SignedLink[] | null = null
    try { signed = await sign(paths) } catch { /* not remembered: the next screen asks again */ }
    if (request !== generation) return
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
    if (scope === null) return Promise.resolve('')
    const hit = known.get(path)
    if (hit && hit.until > now()) return Promise.resolve(hit.url)
    const pending = waiting.get(path)
    if (pending) return pending.promise
    let settle: (url: string) => void = () => {}
    const promise = new Promise<string>((resolve) => { settle = resolve })
    waiting.set(path, { promise, settle })
    if (queue.length === 0) {
      const request = generation
      queueMicrotask(() => { if (request === generation) void flush() })
    }
    queue.push(path)
    return promise
  }

  function clear() {
    ++generation
    queue = []
    known.clear()
    for (const entry of waiting.values()) entry.settle('')
    waiting.clear()
    try { store?.removeItem(storeKey) } catch { /* ignore */ }
  }
  return {
    /** One link per path, in order; an empty string means there is nothing to show. */
    links: (paths: string[]): Promise<string[]> => Promise.all(paths.map(link)),
    /** Forget everything, including what was kept across page loads (call on sign-out). */
    clear,
    /** Access changes discard old requests and persisted links. Initial confirmation may restore the same account. */
    setScope(next: string | null) {
      if (next === scope) return
      if (scope !== null) clear()
      scope = next
      restore()
    },
  }
}
