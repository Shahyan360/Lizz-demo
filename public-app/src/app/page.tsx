import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Mail,
  ScanLine,
  BookOpen,
  SquareCheck,
  Workflow,
  Check,
  CornerDownRight,
  Layers3,
} from 'lucide-react';
import { Brand } from '@/components/brand';
import { ProductPreview } from '@/components/product-preview';
const features = [
  {
    icon: Mail,
    title: 'Every message, understood.',
    text: 'Explore how Lizz sorts sales inquiries, support requests and follow-ups into a clear, useful inbox.',
    label: 'INTELLIGENT TRIAGE',
  },
  {
    icon: Sparkles,
    title: 'A head start on every reply.',
    text: 'Generate contextual drafts with Gemini, inspect the reasoning, and make the final words your own.',
    label: 'CONTEXTUAL AI DRAFTS',
  },
  {
    icon: BookOpen,
    title: 'Answers with something behind them.',
    text: 'See the fictional catalog and policies behind a suggested response. Less guessing. More context.',
    label: 'BUSINESS KNOWLEDGE',
  },
  {
    icon: SquareCheck,
    title: 'Good conversations move things forward.',
    text: 'Turn a support email into an assigned task, review a draft quote, and keep the next step visible.',
    label: 'CONNECTED WORKFLOWS',
  },
];
export default function Home() {
  return (
    <div className="marketing">
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#questions">Questions</a>
        </nav>
        <Link className="button dark small" href="/demo">
          Explore the demo <ArrowUpRight size={15} />
        </Link>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-badge">
            <span className="online-dot" /> A little intelligence. A lot more breathing room.
          </div>
          <h1>
            Less inbox.
            <br />
            <em>More possibility.</em>
            <svg className="hero-star" viewBox="0 0 60 60" aria-hidden="true">
              <path
                d="M30 2v56M2 30h56M10 10l40 40M10 50l40-40"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
          </h1>
          <p>
            Your inbox has work to do. Lizz helps you understand it,
            <br className="desktop-break" /> draft the reply, and turn the conversation into a next
            step.
          </p>
          <div className="hero-actions">
            <Link href="/demo" className="button dark">
              Meet your calmer inbox <ArrowRight size={17} />
            </Link>
            <a href="#how-it-works" className="button text">
              See how it works <span>↘</span>
            </a>
          </div>
          <div className="hero-notes">
            <span>
              <Check size={13} /> No signup needed
            </span>
            <span>
              <Check size={13} /> Fictional data only
            </span>
            <span>
              <Check size={13} /> You approve the actions
            </span>
          </div>
          <div className="hero-product">
            <div className="floating-note">
              <Sparkles size={17} />
              <span>
                From “what now?”
                <br />
                <b>to “already on it.”</b>
              </span>
              <CornerDownRight size={20} />
            </div>
            <ProductPreview />
          </div>
        </section>
        <section className="quiet-strip">
          <span>LESS SORTING.</span>
          <i />
          <span>BETTER CONTEXT.</span>
          <i />
          <span>CLEARER NEXT STEPS.</span>
          <i />
          <span>STILL YOUR CALL.</span>
        </section>
        <section className="section features-section" id="product">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WORK THAT FLOWS</span>
              <h2>
                Your inbox is full of possibilities.
                <br />
                <em>Let’s find the useful ones.</em>
              </h2>
            </div>
            <p>
              The details belong together.
              <br />
              Lizz helps you connect them.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text, label }, i) => (
              <article className="feature-card" key={title}>
                <div className="feature-top">
                  <span className="feature-icon">
                    <Icon size={23} />
                  </span>
                  <span>0{i + 1}</span>
                </div>
                <span className="eyebrow">{label}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="how-intro">
            <span className="eyebrow">FROM MESSAGE TO MOMENTUM</span>
            <h2>
              One email.
              <br />
              <em>A clear way forward.</em>
            </h2>
            <p>
              No mysterious autopilot. Follow the steps from an incoming email to a draft you can
              actually review.
            </p>
            <Link className="button light" href="/demo?view=AI%20studio">
              Try it with a sample email <ArrowRight size={16} />
            </Link>
          </div>
          <div className="pipeline">
            {[
              {
                icon: Mail,
                title: 'A message comes in',
                text: 'Start with a fictional customer conversation.',
              },
              {
                icon: ScanLine,
                title: 'Lizz reads between the lines',
                text: 'Identify the intent, priority, and useful details.',
              },
              {
                icon: Layers3,
                title: 'The right context comes together',
                text: 'Reference relevant catalog and policy information.',
              },
              {
                icon: ShieldCheck,
                title: 'You review. Work moves forward.',
                text: 'Edit the draft, assign the task, approve the next step.',
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <div className="pipeline-step" key={title}>
                <span className="pipeline-number">0{i + 1}</span>
                <span className="pipeline-icon">
                  <Icon size={21} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="section control-section">
          <div className="control-card">
            <span className="eyebrow">THOUGHTFUL BY DESIGN</span>
            <h2>
              Helpful intelligence.
              <br />
              <em>Human judgment.</em>
            </h2>
            <p>
              AI proposes. People decide. Every draft in this demo needs a review, and every action
              stays inside your private demo session.
            </p>
            <div className="control-points">
              <span>
                <ShieldCheck size={18} />
                No real emails sent
              </span>
              <span>
                <BookOpen size={18} />
                No private business records
              </span>
              <span>
                <Workflow size={18} />
                No financial transactions
              </span>
            </div>
            <Link href="/privacy" className="inline-link">
              Read the demo privacy details <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="approval-illustration">
            <div className="approval-sheet">
              <div className="approval-sheet-top">
                <Sparkles size={18} />
                <b>A thoughtful first draft.</b>
                <span className="pill amber">Needs review</span>
              </div>
              <p>Hi Jamie,</p>
              <p>
                Congratulations on the new studio! We’d be happy to help with your furnishing plans.
              </p>
              <p>Our team will confirm pricing and delivery options before making a commitment.</p>
              <div className="approval-divider" />
              <div className="source-chips">
                <span>
                  <BookOpen size={12} /> Product catalog
                </span>
                <span>
                  <BookOpen size={12} /> Shipping guide
                </span>
              </div>
              <div className="approval-footer">
                <span>Your judgment goes here.</span>
                <span className="button dark small">
                  <Check size={14} />
                  Reviewed by you
                </span>
              </div>
            </div>
            <span className="handwritten">A little help. The final say is yours.</span>
          </div>
        </section>
        <section className="section faq-section" id="questions">
          <div>
            <span className="eyebrow">A FEW THINGS TO KNOW</span>
            <h2>
              Curious?
              <br />
              <em>Good place to start.</em>
            </h2>
          </div>
          <div className="faq-list">
            {[
              [
                'Is this a real AI demo?',
                'Yes. Choose a fictional email and use “Run live AI” to call Gemini securely from the server. Live requests have a shared daily budget and a per-visitor allowance. Illustrative sample responses remain available and are labeled separately.',
              ],
              [
                'Do I need to connect my email?',
                'No. The public demo uses entirely fictional Northstar messages, contacts and documents. It cannot access Zoho, Gmail, a real mailbox or the old application’s database.',
              ],
              [
                'Can Lizz send an email or issue a refund?',
                'The public demo cannot send messages, connect accounts, create financial records or process refunds. Approvals and tasks are local simulations.',
              ],
              [
                'Can I create a real company workspace?',
                'Customer accounts and live integrations are not available in this release. This is the public product demonstration; a customer release needs separate storage, authentication and verified organization-owned integrations.',
              ],
              [
                'What happens to changes I make?',
                'Your changes stay in this browser tab’s session storage for up to 12 hours. Reset the demo at any time. Closing the tab ends normal session storage persistence. The AI sees only the fixed fictional sample you select.',
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="final-cta">
          <span className="eyebrow">MAKE ROOM FOR THE WORK YOU LOVE</span>
          <h2>
            Your next good workday
            <br />
            <em>starts with a calmer inbox.</em>
          </h2>
          <Link className="button dark" href="/demo">
            Take Lizz for a spin <ArrowUpRight size={17} />
          </Link>
          <p>No account. No real inbox. Just possibilities.</p>
        </section>
      </main>
      <footer className="site-footer">
        <div>
          <Brand />
          <p>A little clarity for your workday.</p>
        </div>
        <div>
          <Link href="/demo">Public demo</Link>
          <Link href="/docs">Product notes</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Demo terms</Link>
        </div>
        <span>© {new Date().getFullYear()} Lizz. A product in progress.</span>
      </footer>
    </div>
  );
}
