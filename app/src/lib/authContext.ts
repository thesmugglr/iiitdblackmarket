import { createContext, useContext } from 'react'
import type { AuthSnapshot } from './authState'

interface AuthState extends AuthSnapshot {
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

// Provider dependency updates must not recreate the consumers' context.
export const AuthContext = createContext<AuthState>(null!)
export const useAuth = () => useContext(AuthContext)
