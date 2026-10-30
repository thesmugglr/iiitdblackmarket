import type { ReactNode } from 'react';

export type IconName = 'arrow-up' | 'arrow-right' | 'exchange' | 'spark' | 'circle-check' | 'headphones' | 'book' | 'lamp' | 'cycle' | 'game' | 'grid' | 'shield' | 'chat' | 'plus' | 'close' | 'menu';

const paths: Record<IconName, ReactNode> = {
  'arrow-up': <path d="M6 18 18 6M6 6h12v12" />,
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  exchange: <path d="M4 8h15m-5-5 5 5-5 5M20 16H5m5-5-5 5 5 5" />,
  spark: <path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5" />,
  'circle-check': <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  headphones: <path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13h3v8H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Zm16 0h-3v8h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2Z" />,
  book: <path d="M12 6c-3-3-7-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15" />,
  lamp: <path d="m8 3-5 9h18l-5-9H8Zm4 9v9m-5 0h10m2-9v4" />,
  cycle: <><circle cx="5" cy="16" r="4" /><circle cx="19" cy="16" r="4" /><path d="m5 16 5-9 5 9H5m10-13h3l1 13M8 7h6" /></>,
  game: <path d="M8 7h8c3 0 4 2 5 5l1 5c.5 3-2 4-4 2l-3-3H9l-3 3c-2 2-4.5 1-4-2l1-5c1-3 2-5 5-5Zm-3 5h6m-3-3v6m8-3h.01m3-2h.01" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 17.5h7m-3.5-3.5v7" /></>,
  shield: <><path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z" /><path d="m8 12 3 3 5-6" /></>,
  chat: <><path d="M21 11a9 9 0 0 1-9 9 12 12 0 0 1-4-1l-6 2 2-6a12 12 0 0 1-1-4 9 9 0 0 1 18 0Z" /><path d="M7 10h10m-10 4h6" /></>,
  plus: <path d="M5 12h14M12 5v14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};

export function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
