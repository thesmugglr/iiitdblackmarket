import { useRef, useState } from 'react';
import { Icon, type IconName } from '../../components/Icon';

const categories: { id: string; title: string; icon: IconName; description: string; examples: string }[] = [
  { id: 'tech', title: 'Tech & gadgets', icon: 'headphones', description: 'An upgrade for you. A fresh start for someone else.', examples: 'Headphones, keyboards, cameras, and the tech that makes campus life better.' },
  { id: 'books', title: 'Books & notes', icon: 'book', description: 'The next chapter starts with a hand-me-down.', examples: 'Course books, reference material, novels, and your next weekend read.' },
  { id: 'hostel', title: 'Hostel essentials', icon: 'lamp', description: 'Make a little room feel a little more like you.', examples: 'Desk lamps, storage, furniture, and useful things for your hostel room.' },
  { id: 'cycles', title: 'Cycles & more', icon: 'cycle', description: 'Less walking. More getting where you want to be.', examples: 'Cycles, helmets, locks, and accessories for the ride across campus.' },
  { id: 'play', title: 'Play & unwind', icon: 'game', description: 'Because campus life happens after class, too.', examples: 'Controllers, board games, sports gear, and everything for your downtime.' },
  { id: 'other', title: 'Everything else', icon: 'grid', description: 'The unexpected find you didn’t know you needed.', examples: 'Clothing, creative supplies, and all the little things worth passing on.' },
];

const questions = [
  { question: 'Who is this for?', answer: 'IIIT-Delhi students. The marketplace requires an institute account and student eligibility approval before members can list items or contact each other.' },
  { question: 'Can I rent or give things away?', answer: 'Yes. Alongside buying and selling, rental and giveaway listings help useful things keep moving around campus.' },
  { question: 'How will I contact someone?', answer: 'Private conversations inside the website are linked to items. You won’t need to publish your phone number just to start a chat.' },
  { question: 'Is the marketplace live yet?', answer: 'This is the public homepage. The private marketplace requires institute sign-in and student approval. If campus access hasn’t opened yet, sign-in will be unavailable. The artwork is illustrative; these items are not listings.' },
];

interface LandingPageProps {
  configured: boolean;
  signingIn: boolean;
  error: string;
  onSignIn: () => Promise<void>;
}

export default function LandingPage({ configured, signingIn, error, onSignIn }: LandingPageProps) {
  const [selectedId, setSelectedId] = useState('tech');
  const [menuOpen, setMenuOpen] = useState(false);
  const accessDialog = useRef<HTMLDialogElement>(null);
  const selected = categories.find((category) => category.id === selectedId)!;
  const openAccess = () => accessDialog.current?.showModal();

  return (
    <div className="landing-page">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header container">
        <a className="wordmark" href="#" aria-label="IIITD Black Market home">
          <span className="brand-symbol" aria-hidden="true"><Icon name="exchange" /></span>
          <span>blackmarket<span className="brand-campus">IIIT DELHI / STUDENT TO STUDENT</span></span>
        </a>
        <button className="menu-toggle icon-button" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
        <nav id="main-nav" className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#categories" onClick={() => setMenuOpen(false)}>The marketplace</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#questions" onClick={() => setMenuOpen(false)}>FAQs</a>
        </nav>
        <button className="button button-small header-access" type="button" onClick={openAccess}>Campus access <Icon name="arrow-up" /></button>
      </header>

      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" /> {configured ? 'IIIT–DELHI / STUDENT TO STUDENT' : 'COMING TO IIIT–DELHI'}</p>
            <h1 id="hero-title">GOOD FINDS.<br /><span>JUST A <br />WALK AWAY.</span></h1>
            <p className="hero-description">Your next favourite thing might be in the hostel next door. Buy, sell, rent, and pass it on. All within campus.</p>
            <div className="hero-actions">
              <a className="button" href="#categories">Explore categories <Icon name="arrow-right" /></a>
              <a className="text-link" href="#how-it-works">See how it works <Icon name="arrow-up" /></a>
            </div>
            <p className="hero-footnote"><Icon name="circle-check" /> A little less waste. A lot more possibility.</p>
          </div>
          <div className="hero-art">
            <div className="art-topline"><span>OLD TO SOMEONE. NEW TO YOU.</span><Icon name="spark" /></div>
            <img src="/images/campus-gear.png" width="1448" height="1086" alt="Illustrative studio arrangement of headphones, a camera, books, and a green game controller" fetchPriority="high" />
            <div className="art-sticker" aria-hidden="true">KEEP THE<br /><strong>GOOD STUFF<br />GOING.</strong><Icon name="exchange" /></div>
            <div className="art-caption"><span>THE CAMPUS CIRCULAR ECONOMY</span><span>01 / IN THE MAKING</span></div>
          </div>
        </section>

        <div className="values-strip" aria-label="Buy smart. Sell easy. Stay on campus.">
          <div className="container"><span>BUY SMART.</span><Icon name="spark" /><span>SELL EASY.</span><Icon name="spark" /><span>STAY ON CAMPUS.</span><Icon name="spark" /><span className="strip-extra" aria-hidden="true">PASS IT ON.</span></div>
        </div>

        <section className="categories-section container section-space" id="categories" aria-labelledby="categories-title">
          <div className="section-heading"><div><p className="eyebrow muted">01 / FIND YOUR THING</p><h2 id="categories-title">A little bit of everything.</h2></div><p className="section-aside">For your desk. Your room.<br />Your next campus chapter.</p></div>
          <div className="category-grid" role="group" aria-label="Explore marketplace categories">
            {categories.map((category) => (
              <button className={`category-card ${category.id === selectedId ? 'is-selected' : ''}`} type="button" key={category.id} aria-pressed={category.id === selectedId} aria-controls="category-detail" onClick={() => setSelectedId(category.id)}>
                <span className="category-icon"><Icon name={category.icon} /></span><span>{category.title}</span><Icon name="arrow-up" />
              </button>
            ))}
          </div>
          <div id="category-detail" className="category-detail" aria-live="polite" aria-atomic="true">
            <div><p className="eyebrow green">{selected.title} / CAMPUS CATEGORIES</p><h3>{selected.description}</h3><p>{selected.examples}</p></div>
            <button type="button" className="text-link" onClick={openAccess}>See campus access <Icon name="arrow-up" /></button>
          </div>
        </section>

        <section className="how-section section-space" id="how-it-works" aria-labelledby="how-title">
          <div className="container">
            <div className="section-heading"><div><p className="eyebrow muted">02 / THE IDEA IS SIMPLE</p><h2 id="how-title">From “don’t need”<br />to “just what I needed.”</h2></div><p className="section-aside">Less back and forth.<br />More passing things forward.</p></div>
            <ol className="steps">
              <li><span className="step-number">01</span><Icon name="shield" /><h3>Keep it in the circle.</h3><p>Access through your IIITD account, with student approval. A marketplace for your campus community.</p></li>
              <li><span className="step-number">02</span><Icon name="exchange" /><h3>Find it. Or list it.</h3><p>A photo, a few details, and a fair price. Buy and sell, rent what you need, or give something a new home.</p></li>
              <li><span className="step-number">03</span><Icon name="chat" /><h3>Chat. Meet. Done.</h3><p>Start a private conversation right here. Agree on the details, then arrange your handover on campus.</p></li>
            </ol>
          </div>
        </section>

        <section className="faq-section container section-space" id="questions" aria-labelledby="faq-title">
          <div><p className="eyebrow muted">03 / GOOD QUESTIONS</p><h2 id="faq-title">A few things<br />to know.</h2><p className="faq-note">Built for the people<br />you share a campus with.</p></div>
          <div className="faq-list">{questions.map((item) => <details key={item.question}><summary>{item.question}<Icon name="plus" /></summary><p>{item.answer}</p></details>)}</div>
        </section>

        <section className="closing-section container" aria-labelledby="closing-title">
          <div className="closing-panel"><div><p className="eyebrow">SAME CAMPUS. NEW POSSIBILITIES.</p><h2 id="closing-title">GOOD STUFF.<br />SECOND CHANCES.</h2><p>Some things are too good to leave in a drawer.</p><button className="button button-dark" type="button" onClick={openAccess}>Let’s keep them moving <Icon name="arrow-up" /></button></div><span className="closing-art" aria-hidden="true"><Icon name="exchange" /></span></div>
        </section>
      </main>

      <footer className="site-footer container"><div><a className="footer-brand" href="#">blackmarket<span>↗</span></a><p>By students. For the campus.</p></div><div className="footer-meta"><span><span className="status-dot" /> IIIT–DELHI / IN THE MAKING</span><a href="#main">Back to top <Icon name="arrow-up" /></a></div></footer>

      <dialog ref={accessDialog} className="access-dialog" aria-labelledby="access-title" aria-describedby="access-description" onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) accessDialog.current?.close();
      }}>
        <div className="dialog-header"><span className="eyebrow green">THE CAMPUS CIRCLE</span><button autoFocus className="icon-button" type="button" aria-label="Close access details" onClick={() => accessDialog.current?.close()}><Icon name="close" /></button></div>
        <span className="dialog-symbol"><Icon name="shield" /></span><h2 id="access-title">Your campus.<br />Your people.</h2><p id="access-description">{configured ? 'Continue with your IIITD Google account. Marketplace access requires current-student approval after sign-in.' : 'Campus access hasn’t opened on this preview yet. When it’s ready, you’ll use your IIITD account and complete student approval to enter the marketplace.'}</p><p className="dialog-note">Your institute account stays with Google. You don’t need to share your phone number to start a conversation.</p>{error && <p role="alert" className="error">{error}</p>}{configured ? <button className="button" type="button" disabled={signingIn} onClick={() => void onSignIn()}>{signingIn ? 'Opening Google…' : 'Continue with Google'}<Icon name="arrow-right" /></button> : <button className="button" type="button" onClick={() => accessDialog.current?.close()}>Got it <Icon name="arrow-right" /></button>}
      </dialog>
    </div>
  );
}
