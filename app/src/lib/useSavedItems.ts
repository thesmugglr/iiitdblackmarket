import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { emptySavedItems, observeSavedItems } from './savedItemsState'

export function useSavedItems(ownerId: string | undefined) {
  const [state, setState] = useState(() => ({ ...emptySavedItems(), ownerId }))
  const observer = useRef<{ ownerId: string; current: ReturnType<typeof observeSavedItems> } | null>(null)
  useEffect(() => {
    if (!ownerId) return
    const current = observeSavedItems({
      load: async () => {
        const { data, error } = await supabase.from('saved_items').select('listing_id').eq('user_id', ownerId)
        if (error) throw error
        return (data ?? []).map(row => row.listing_id as string)
      },
      write: async (id, saved) => {
        const { error } = saved
          ? await supabase.from('saved_items').upsert({ user_id: ownerId, listing_id: id }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true })
          : await supabase.from('saved_items').delete().eq('user_id', ownerId).eq('listing_id', id)
        if (error) throw error
      },
      publish: snapshot => setState({ ...snapshot, ownerId }),
    })
    observer.current = { ownerId, current }
    return () => { observer.current = null; current.dispose() }
  }, [ownerId])
  const toggle = useCallback(async (id: string) => {
    const active = observer.current
    if (active && active.ownerId === ownerId) await active.current.toggle(id)
  }, [ownerId])
  const retry = useCallback(async () => {
    const active = observer.current
    if (active && active.ownerId === ownerId) await active.current.retry()
  }, [ownerId])
  // Never expose a preceding account's collection while a new effect mounts.
  const snapshot = state.ownerId === ownerId ? state : emptySavedItems()
  return { ...snapshot, toggle, retry }
}
