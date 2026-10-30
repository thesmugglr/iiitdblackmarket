import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Camera,
  Handshake,
  MessageCircle,
  Quote,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Brand, Reveal } from "./Primitives";
import { useState, type FormEvent } from "react";

export function StorySections({
  onCreate,
  onAbout,
}: {
  onCreate: () => void;
  onAbout: () => void;
}) {
  const [newsletter, setNewsletter] = useState("");
  const [notice, setNotice] = useState("");
  const signup = (e: FormEvent) => {
    e.preventDefault();
    setNewsletter("");
    setNotice(
      "Email updates aren’t open in this preview. No address was saved or sent.",
    );
  };
  return (
    <>
      <section className="how-section section-space" id="how-it-works">
        <div className="content-width">
          <Reveal className="section-heading">
            <div>
              <p className="eyebrow">SMALL EFFORT. GOOD THINGS.</p>
              <h2>
                A second life.
                <br />
                <em>In three simple steps.</em>
              </h2>
            </div>
            <p>
              Less back and forth.
              <br />
              More passing things forward.
            </p>
          </Reveal>
          <ol className="steps-grid">
            {[
              {
                n: "01",
                icon: Camera,
                title: "Make a little room.",
                body: "Snap a few photos. Add the details. Give that good thing a chance to be someone else’s favourite.",
              },
              {
                n: "02",
                icon: MessageCircle,
                title: "Find your people.",
                body: "Ask a question, talk about the price, and work out the details. All within your campus circle.",
              },
              {
                n: "03",
                icon: Handshake,
                title: "Meet. Pass it on.",
                body: "A quick walk, a campus handover, and a new chapter. Good for your room. A little better for the planet.",
              },
            ].map((step, i) => (
              <Reveal delay={i * 0.08} key={step.n}>
                <li className="step">
                  <div className="step-art">
                    <span aria-hidden="true">{step.n}</span>
                    <step.icon size={42} strokeWidth={1.1} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="trust-section content-width section-space"
        id="campus-circle"
      >
        <Reveal className="section-heading">
          <div>
            <p className="eyebrow">FAMILIAR FACES. BETTER FINDS.</p>
            <h2>
              A smaller circle.
              <br />
              <em>A little more trust.</em>
            </h2>
          </div>
          <p>
            Designed around campus life,
            <br />
            and the people who make it.
          </p>
        </Reveal>
        <div className="trust-grid">
          <Reveal className="trust-principles">
            <div className="trust-icon">
              <ShieldCheck size={28} strokeWidth={1.3} />
            </div>
            <h3>
              Community,
              <br />
              before commerce.
            </h3>
            <p>
              Institute sign-in, student approval, and conversations inside the
              site. A thoughtful foundation for the real marketplace.
            </p>
            <span className="trust-rule" />
            <div className="trust-check">
              <BadgeCheck size={17} />
              <span>Student-only access is the goal.</span>
            </div>
            <button className="text-link" onClick={onAbout}>
              About this preview <ArrowUpRight size={15} />
            </button>
          </Reveal>
          <Reveal className="story-card story-one" delay={0.08}>
            <span className="story-label">ILLUSTRATIVE STUDENT STORY</span>
            <div className="stars" aria-label="Example five-star feedback">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={13} fill="currentColor" />
              ))}
            </div>
            <Quote className="quote-mark" size={30} strokeWidth={1} />
            <blockquote>
              “The book I needed was one corridor away. That’s the kind of
              campus convenience I’d come back for.”
            </blockquote>
            <div className="story-person">
              <span className="avatar avatar-1">IR</span>
              <div>
                <strong>Ishita R.</strong>
                <span>Sample profile · Class of ’26</span>
              </div>
            </div>
          </Reveal>
          <Reveal className="story-card story-two" delay={0.16}>
            <span className="story-label">ILLUSTRATIVE STUDENT STORY</span>
            <div className="stars" aria-label="Example five-star feedback">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={13} fill="currentColor" />
              ))}
            </div>
            <Quote className="quote-mark" size={30} strokeWidth={1} />
            <blockquote>
              “A less cluttered room, and a desk lamp that gets another
              semester. Everybody wins.”
            </blockquote>
            <div className="story-person">
              <span className="avatar avatar-2">AM</span>
              <div>
                <strong>Aarav M.</strong>
                <span>Sample profile · Class of ’27</span>
              </div>
            </div>
          </Reveal>
        </div>
        <p className="trust-disclaimer">
          A visual concept of the community experience. Profiles, ratings, and
          quotes are illustrative—not real reviews.
        </p>
      </section>

      <section className="cta-section content-width">
        <Reveal className="cta-panel">
          <div className="cta-decoration" aria-hidden="true">
            ✳
          </div>
          <div>
            <p className="eyebrow">
              SOME THINGS ARE TOO GOOD TO SIT IN A DRAWER.
            </p>
            <h2>
              Your next bit of space.
              <br />
              <em>Someone’s next favourite thing.</em>
            </h2>
            <p>Give the good stuff another chapter.</p>
            <button className="primary-button" type="button" onClick={onCreate}>
              List your first item <ArrowUpRight size={18} />
            </button>
          </div>
          <span className="cta-footnote">
            A LITTLE LESS NEW. A LOT MORE POSSIBLE.
          </span>
        </Reveal>
      </section>

      <footer className="footer content-width">
        <div className="footer-top">
          <div>
            <a href="#top" aria-label="Blackmarket home">
              <Brand />
            </a>
            <p>
              Good things deserve another chapter.
              <br />A marketplace, a little closer to home.
            </p>
          </div>
          <nav aria-label="Footer">
            <a href="#marketplace">The marketplace</a>
            <a href="#how-it-works">How it works</a>
            <a href="#campus-circle">The campus circle</a>
            <button type="button" onClick={onAbout}>
              About this preview
            </button>
          </nav>
          <div className="newsletter">
            <h3>A good thing in your inbox.</h3>
            <p>Campus finds, when there’s something worth sharing.</p>
            <form onSubmit={signup}>
              <input
                type="email"
                required
                aria-label="Email for campus updates preview"
                placeholder="Your email address"
                value={newsletter}
                onChange={(e) => setNewsletter(e.target.value)}
              />
              <button type="submit" aria-label="Request campus updates">
                <ArrowRight size={18} />
              </button>
            </form>
            <p className="newsletter-note" role="status">
              {notice ||
                "Preview only. This form does not collect email addresses."}
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            Made for the IIIT–Delhi circle. Not affiliated with the institute.
          </span>
          <span>
            Design preview · 12 illustrative listings{" "}
            <span aria-hidden="true">↗</span>
          </span>
        </div>
      </footer>
    </>
  );
}
