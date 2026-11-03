import type { SupabaseClient } from '@supabase/supabase-js'

export interface TextRequest { id: string; body: string }
export interface TextComposer { text: string; sending: boolean; error: string }
export const emptyTextComposer = (): TextComposer => ({ text: '', sending: false, error: '' })

export async function sendChatText(
  api: Pick<SupabaseClient, 'from'>,
  conversation: string,
  sender: string,
  request: TextRequest,
) {
  if (!request.body.trim() || request.body.length > 2000) throw new Error('Invalid message text')
  const row = { id: request.id, conversation_id: conversation, sender_id: sender, body: request.body }
  // A response may be lost after the insert commits. Reusing this client ID
  // with DO NOTHING makes a same-draft retry safe without an UPDATE policy.
  const result = await api.from('messages').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
  if (result.error) throw new Error('Message write failed')
  const confirmed = await api.from('messages').select('id,conversation_id,sender_id,body,image_path').eq('id', request.id).single()
  const message = confirmed.data
  if (confirmed.error || message?.id !== request.id || message?.conversation_id !== conversation || message?.sender_id !== sender || message?.body !== request.body || message?.image_path !== null) {
    throw new Error('Message could not be confirmed')
  }
}

interface TextSource {
  newId: () => string
  write: (request: TextRequest) => Promise<void>
  publish: (snapshot: TextComposer) => void
}

// One composer belongs to one mounted conversation/account. Draft revisions
// distinguish text typed during a send, even if it ends up identical again.
export function observeTextComposer(source: TextSource) {
  let active = true, busy = false, revision = 0
  let pending: TextRequest | null = null
  let snapshot = emptyTextComposer()
  const publish = (next: Partial<TextComposer>) => {
    if (!active) return
    snapshot = { ...snapshot, ...next }
    source.publish(snapshot)
  }
  publish(snapshot)
  const edit = (text: string) => {
    if (!active) return
    ++revision
    publish({ text, error: '' })
  }
  const send = async () => {
    const body = snapshot.text.trim()
    if (!active || busy || !body) return
    busy = true
    const submittedRevision = revision
    publish({ sending: true, error: '' })
    try {
      if (!pending || pending.body !== body) pending = { id: source.newId(), body }
      await source.write(pending)
      if (!active) return
      pending = null
      if (submittedRevision === revision) publish({ text: '' })
    } catch {
      publish({ error: 'Could not confirm sending. Your draft is retained. Press Send to retry.' })
    } finally {
      busy = false
      publish({ sending: false })
    }
  }
  return { edit, send, dispose: () => { active = false } }
}
