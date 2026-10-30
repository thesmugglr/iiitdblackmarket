import { useEffect, useState } from 'react';
import { getHealth } from './lib/api';

export function App() {
  const [status, setStatus] = useState('Connecting to the backend…');
  useEffect(() => {
    const controller = new AbortController();
    void getHealth(controller.signal)
      .then(() => setStatus('Backend connected'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('Backend unavailable. Start the API to connect.');
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <header><a href="/" aria-label="IIITD Black Market home">IIITD <strong>Black Market</strong></a><span>Built for campus</span></header>
      <section className="intro" aria-labelledby="title">
        <p className="eyebrow">THE CAMPUS MARKETPLACE</p>
        <h1 id="title">A second life for<br />your campus essentials.</h1>
        <p>Buy, sell, rent, and pass things on within the IIIT-Delhi community.</p>
        <div className="notice"><strong>We’re getting things ready.</strong><p>Student sign-in, item listings, and private chat are coming next.</p></div>
      </section>
      <footer><p role="status">{status}</p><p>IIITD Black Market · Development foundation</p></footer>
    </main>
  );
}
