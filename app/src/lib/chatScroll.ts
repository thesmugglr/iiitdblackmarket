/** Scroll only the conversation list; never scroll its page ancestors. */
export function nearChatBottom(list: { scrollHeight: number; scrollTop: number; clientHeight: number }) {
  return list.scrollHeight - list.scrollTop - list.clientHeight <= 64
}
export function shouldFollowChat(previous: string | null, latest: string, own: boolean, following: boolean) {
  return previous === null || following || (previous !== latest && own)
}
