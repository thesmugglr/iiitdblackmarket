import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'

export default function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  const calm = useReducedMotion()
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close.current(); return }
      if (e.key !== 'Tab') return
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') ?? []).filter((el) => el.getClientRects().length > 0)
      const first = controls[0], last = controls[controls.length - 1]
      if (!first) { e.preventDefault(); ref.current?.focus(); return }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = oldOverflow; prev?.focus() }
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="drawer"
            initial={calm ? false : { x: '100%' }} animate={{ x: 0 }} exit={calm ? { opacity: 0 } : { x: '100%' }} transition={calm ? { duration: 0 } : { type: 'spring', damping: 32, stiffness: 320 }}>
            <header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></header>
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
