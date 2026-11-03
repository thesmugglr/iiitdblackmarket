import type { Session } from '@supabase/supabase-js'
import type { Profile } from './types'

export interface AuthSnapshot {
  session: Session | null
  profile: Profile | null
  loading: boolean
}

interface AuthSource {
  getSession: () => Promise<Session | null>
  subscribe: (callback: (session: Session | null) => void) => () => void
  loadProfile: () => Promise<Profile | null>
  publish: (snapshot: AuthSnapshot) => void
  accessChanged?: (approvedAccount: string | null) => void
}

// Own one mounted provider's requests. An old request must never publish into a
// newer account, a signed-out session, or a provider that has been unmounted.
export function observeAuth(source: AuthSource) {
  let snapshot: AuthSnapshot = { session: null, profile: null, loading: true }
  let active = true
  let revision = 0
  let sawAuthEvent = false
  let scheduled: ReturnType<typeof setTimeout> | undefined

  const publish = (next: AuthSnapshot) => {
    // Invalidate signed-image capabilities before exposing a new access state.
    source.accessChanged?.(next.profile?.status === 'approved' && next.profile.id === next.session?.user.id ? next.profile.id : null)
    snapshot = next
    source.publish(next)
  }

  const load = async (request: number) => {
    if (!active || request !== revision || !snapshot.session) return
    let profile: Profile | null = null
    try {
      profile = await source.loadProfile()
    } catch { /* Fail closed; Pending offers a retry without an unhandled rejection. */ }
    if (!active || request !== revision) return
    // Also reject an inconsistent profile rather than granting the wrong UI gate.
    if (profile?.id !== snapshot.session?.user.id) profile = null
    publish({ ...snapshot, profile, loading: false })
  }

  const applySession = (session: Session | null) => {
    if (!active) return
    const request = ++revision
    clearTimeout(scheduled)
    const sameAccount = !!session && session.user.id === snapshot.session?.user.id
    publish({
      session,
      profile: sameAccount ? snapshot.profile : null,
      loading: !!session && (!sameAccount || snapshot.loading),
    })
    // Supabase invokes auth callbacks while updating its session. Start RPC work
    // in a later task so the callback returns before acquiring auth locks again.
    if (session) scheduled = setTimeout(() => { void load(request) }, 0)
  }

  const unsubscribe = source.subscribe(session => {
    sawAuthEvent = true
    applySession(session)
  })
  // Fallback is needed for sources such as the development demo that don't emit
  // INITIAL_SESSION. It cannot overwrite an auth event that arrived meanwhile.
  void source.getSession().then(session => {
    if (!sawAuthEvent) applySession(session)
  }, () => {
    if (!sawAuthEvent) applySession(null)
  })

  return {
    refresh: async () => {
      if (!active || !snapshot.session) return
      clearTimeout(scheduled)
      await load(++revision)
    },
    dispose: () => {
      active = false
      ++revision
      clearTimeout(scheduled)
      unsubscribe()
      source.accessChanged?.(null)
    },
  }
}
