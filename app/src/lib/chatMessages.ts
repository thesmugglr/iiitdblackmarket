import type { SupabaseClient } from '@supabase/supabase-js'

interface MessageDraft { id: string; conversation_id: string; sender_id: string; body: string; image_path?: string; reply_to_id?: string }

// Text and image sends share insert-only IDs and exact read-back confirmation.
// A retry after a lost response cannot overwrite an existing message.
export async function writeChatMessage(api: Pick<SupabaseClient, 'from'>, row: MessageDraft) {
  const result = await api.from('messages').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
  if (result.error) throw new Error('Message write failed')
  const confirmed = await api.from('messages').select('id,conversation_id,sender_id,body,image_path,reply_to_id').eq('id', row.id).single()
  const message = confirmed.data
  if (confirmed.error || message?.id !== row.id || message?.conversation_id !== row.conversation_id || message?.sender_id !== row.sender_id || message?.body !== row.body || message?.image_path !== (row.image_path ?? null) || (message?.reply_to_id ?? null) !== (row.reply_to_id ?? null)) {
    throw new Error('Message could not be confirmed')
  }
}
