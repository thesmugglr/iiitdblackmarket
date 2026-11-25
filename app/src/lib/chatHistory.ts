import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message } from './types'

/** Both reads use the signed-in client and the existing message read policies. */
export async function loadChatHistory(api: Pick<SupabaseClient, 'from'>, id: string): Promise<Message[]> {
  // This is the same relationship that supplies the Inbox preview. It also works
  // when a browser can reach conversations but blocks the separate messages URL.
  const thread = await api.from('conversations').select('id,history:messages(*)').eq('id', id)
    .order('created_at', { referencedTable: 'history' })
    .order('id', { referencedTable: 'history' }).maybeSingle()
  if (!thread.error && thread.data?.id === id && Array.isArray(thread.data.history)) {
    return thread.data.history as Message[]
  }
  const result = await api.from('messages').select('*').eq('conversation_id', id).order('created_at').order('id')
  if (result.error || !Array.isArray(result.data)) throw new Error('Could not load conversation history')
  return result.data as Message[]
}
