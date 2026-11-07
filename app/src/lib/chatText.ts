import type { SupabaseClient } from '@supabase/supabase-js'
import { writeChatMessage } from './chatMessages.ts'

export interface TextRequest { id: string; body: string; replyTo?: string }
export interface TextComposer { text: string; sending: boolean; error: string }
export const emptyTextComposer = (): TextComposer => ({ text: '', sending: false, error: '' })

export async function sendChatText(
  api: Pick<SupabaseClient, 'from'>,
  conversation: string,
  sender: string,
  request: TextRequest,
) {
  if (!request.body.trim() || request.body.length > 2000) throw new Error('Invalid message text')
  const row = { id: request.id, conversation_id: conversation, sender_id: sender, body: request.body, ...(request.replyTo ? { reply_to_id: request.replyTo } : {}) }
  return writeChatMessage(api, row)
}

interface TextSource {
  newId: () => string
  write: (request: TextRequest) => Promise<void>
  /** The message being replied to when Send is pressed; kept with the draft so a retry replies to the same one. */
  replyTo?: () => string | undefined
  /** Called after a confirmed send, e.g. to close the reply preview. */
  sent?: () => void
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
      const replyTo = source.replyTo?.()
      if (!pending || pending.body !== body || pending.replyTo !== replyTo) pending = { id: source.newId(), body, ...(replyTo ? { replyTo } : {}) }
      await source.write(pending)
      if (!active) return
      pending = null
      source.sent?.()
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
