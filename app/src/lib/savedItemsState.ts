export interface SavedItemsSnapshot {
  ids: Set<string>
  pending: Set<string>
  loading: boolean
  error: string
}
export const emptySavedItems = (): SavedItemsSnapshot => ({ ids: new Set(), pending: new Set(), loading: true, error: '' })

interface SavedItemsSource {
  load: () => Promise<string[]>
  write: (id: string, saved: boolean) => Promise<void>
  publish: (snapshot: SavedItemsSnapshot) => void
}

export function observeSavedItems(source: SavedItemsSource) {
  let active = true
  let ready = false
  let reading = false
  let snapshot = emptySavedItems()
  const publish = (next: Partial<SavedItemsSnapshot>) => {
    if (!active) return
    snapshot = { ...snapshot, ...next }
    source.publish(snapshot)
  }
  const retry = async () => {
    // A fresh read cannot race writes and erase their confirmed results.
    if (!active || reading || snapshot.pending.size) return
    reading = true
    ready = false
    publish({ loading: true, error: '' })
    try {
      const ids = await source.load()
      if (!active) return
      ready = true
      publish({ ids: new Set(ids) })
    } catch {
      publish({ error: 'Could not load saved items. Please try again.' })
    } finally {
      reading = false
      publish({ loading: false })
    }
  }
  const toggle = async (id: string) => {
    if (!active || !ready || reading || snapshot.pending.has(id)) return
    const saved = !snapshot.ids.has(id)
    publish({ pending: new Set([...snapshot.pending, id]), error: '' })
    try {
      await source.write(id, saved)
      if (!active) return
      // Merge with current state, not the Set captured before another item saved.
      const ids = new Set(snapshot.ids)
      if (saved) ids.add(id)
      else ids.delete(id)
      publish({ ids })
    } catch {
      publish({ error: 'Could not update this saved item. Please try again.' })
    } finally {
      const pending = new Set(snapshot.pending)
      pending.delete(id)
      publish({ pending })
    }
  }
  void retry()
  return { retry, toggle, dispose: () => { active = false } }
}
