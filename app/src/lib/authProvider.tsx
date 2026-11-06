import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Profile } from './types'
import { observeAuth, type AuthSnapshot } from './authState'
import { forgetPhotoLinks, setPhotoLinkAccount } from './photoLinks'
import { AuthContext } from './authContext'
import { forgetThisDevice } from './push'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({ session: null, profile: null, loading: true })
  const observer = useRef<ReturnType<typeof observeAuth> | null>(null)
  const refresh = useCallback(async () => { await observer.current?.refresh() }, [])

  useEffect(() => {
    const current = observeAuth({
      getSession: async () => {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        return data.session
      },
      subscribe: callback => {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
        return () => data.subscription.unsubscribe()
      },
      loadProfile: async () => {
        const { data, error } = await supabase.rpc('my_profile').maybeSingle()
        if (error) throw error
        return data as Profile | null
      },
      accessChanged: setPhotoLinkAccount,
      publish: setSnapshot,
    })
    observer.current = current
    return () => {
      observer.current = null
      current.dispose()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ...snapshot,
        refresh,
        signOut: async () => {
          forgetPhotoLinks()
          await forgetThisDevice(supabase)
          await supabase.auth.signOut()
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
