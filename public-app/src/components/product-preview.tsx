import {
  ArrowUpRight,
  Check,
  Inbox,
  Sparkles,
  SquareCheck,
  BookOpen,
  LayoutDashboard,
  Workflow,
  ShieldCheck,
} from 'lucide-react';
import { emails } from '@/lib/demo-data';
import { Mark } from './brand';
export function ProductPreview() {
  return (
    <div
      className="product-preview"
      aria-label="Preview of the Lizz demo inbox with fictional data"
    >
      <div className="preview-chrome">
        <div className="window-dots">
          <i />
          <i />
          <i />
        </div>
        <span>lizz / northstar workspace</span>
        <span className="preview-demo">DEMO WORKSPACE</span>
      </div>
      <div className="preview-inner">
        <aside className="preview-nav">
          <div className="preview-wordmark">
            <Mark />
            lizz.
          </div>
          <div className="preview-workspace">
            N{' '}
            <span>
              Northstar <small>Demo workspace</small>
            </span>
          </div>
          <span>
            <LayoutDashboard size={15} />
            Overview
          </span>
          <span className="selected">
            <Inbox size={15} />
            Inbox <b>7</b>
          </span>
          <span>
            <Sparkles size={15} />
            AI studio
          </span>
          <span>
            <SquareCheck size={15} />
            Tasks
          </span>
          <span>
            <ShieldCheck size={15} />
            Approvals
          </span>
          <span>
            <BookOpen size={15} />
            Knowledge
          </span>
          <span>
            <Workflow size={15} />
            Automations
          </span>
          <div className="preview-bottom">
            <span className="online-dot" /> Everything in its place.
          </div>
        </aside>
        <div className="preview-content">
          <div className="preview-title">
            <div>
              <small>YOUR WORKDAY, A LITTLE LIGHTER</small>
              <h3>A calmer kind of inbox.</h3>
            </div>
            <span className="pill green">
              <Sparkles size={12} />
              AI is ready
            </span>
          </div>
          <div className="preview-toolbar">
            <b>
              All messages <span>7</span>
            </b>
            <span>
              Needs review <span>3</span>
            </span>
            <span>Processed</span>
          </div>
          <div className="preview-inbox">
            <div className="preview-list">
              {emails.slice(0, 4).map((email, i) => (
                <div className={`preview-email ${i === 0 ? 'active' : ''}`} key={email.id}>
                  <span className={`avatar ${email.color}`}>{email.initials}</span>
                  <div>
                    <b>
                      {email.name}
                      <small>{email.time}</small>
                    </b>
                    <strong>{email.subject}</strong>
                    <p>{email.body.replace(/\n/g, ' ').slice(0, 62)}…</p>
                    <span className="mini-pill">{email.intent}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="preview-reading">
              <div className="reading-top">
                <span className="eyebrow">THE RIGHT CONTEXT, RIGHT HERE</span>
                <ArrowUpRight size={16} />
              </div>
              <h4>A little help with our new studio setup?</h4>
              <p>Hi Northstar team,</p>
              <p>
                We’re moving into a new studio next month and would love a quote for 24 Atlas
                Standing Desks and 24 Focus Chairs.
              </p>
              <div className="preview-insight">
                <div>
                  <Sparkles size={15} />
                  <b>Lizz connected the dots</b>
                </div>
                <p>Quotation request · High priority</p>
                <div className="preview-fields">
                  <span>
                    Products <b>2 items</b>
                  </span>
                  <span>
                    Quantity <b>48 units</b>
                  </span>
                  <span>
                    Context <b>2 sources</b>
                  </span>
                </div>
                <span className="review-ready">
                  <Check size={13} />
                  Draft ready for your review
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="preview-caption">
        <ShieldCheck size={13} /> Fictional data. Real product interactions. You’re always in
        control.
      </div>
    </div>
  );
}
