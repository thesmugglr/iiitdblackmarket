const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
export const Grid = () => <svg {...base}><rect x="4" y="4" width="6.5" height="6.5"/><rect x="13.5" y="4" width="6.5" height="6.5"/><rect x="4" y="13.5" width="6.5" height="6.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5"/></svg>
export const Heart = ({ filled }: { filled?: boolean }) => <svg {...base} fill={filled ? 'currentColor' : 'none'}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
export const Plus = () => <svg {...base}><path d="M12 5v14M5 12h14"/></svg>
export const Chat = () => <svg {...base}><path d="M4 5h16v11H9l-5 4z"/></svg>
export const User = () => <svg {...base}><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>
export const Clip = () => <svg {...base}><path d="M20 11.5l-8 8a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.7 1.7 0 0 1-2.4-2.4l8-8"/></svg>
export const Camera = () => <svg {...base}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>
export const ArrowUp = () => <svg {...base}><path d="M12 19V5M6 11l6-6 6 6"/></svg>
export const Arrow = () => <svg {...base}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
export const Search = () => <svg {...base}><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
export const Bell = () => <svg {...base}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/></svg>
export const Shield = () => <svg {...base}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
