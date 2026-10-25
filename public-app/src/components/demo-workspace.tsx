'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CircleX,
  Clock3,
  Download,
  FileText,
  Inbox,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareCheck,
  Trash2,
  Users,
  Workflow,
  X,
  Zap,
  Activity,
  Plug,
  CircleCheck,
  Send,
} from 'lucide-react';
import { Brand } from './brand';
import {
  emails,
  knowledge,
  team,
  tones,
  intents,
  fictionalSubtotal,
  type AnalysisResult,
  type DemoTask,
  type DemoRule,
  type DemoEmail,
} from '@/lib/demo-data';
import {
  applyAnalysis,
  freshState,
  restoreState,
  STORAGE_KEY,
  type DemoState,
} from '@/lib/demo-state';

const navigation = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Inbox', icon: Inbox },
  { name: 'AI studio', icon: Sparkles },
  { name: 'Tasks', icon: SquareCheck },
  { name: 'Approvals', icon: ShieldCheck },
  { name: 'Estimates', icon: FileText },
  { name: 'Knowledge', icon: BookOpen },
  { name: 'Automations', icon: Workflow },
  { name: 'Activity', icon: Activity },
  { name: 'Integrations', icon: Plug },
  { name: 'Team', icon: Users },
  { name: 'Settings', icon: Settings2 },
];
const descriptions: Record<string, string> = {
  Overview: 'A little clarity for the day ahead.',
  Inbox: 'Good conversations. Clear next steps.',
  'AI studio': 'See how a message becomes a useful next step.',
  Tasks: 'Keep the next step moving.',
  Approvals: 'Your judgment makes the difference.',
  Estimates: 'From a request to a considered draft.',
  Knowledge: 'The context behind a good answer.',
  Automations: 'Small rules. A smoother workday.',
  Activity: 'A clear trail of what happened.',
  Integrations: 'A safe space, with no real accounts connected.',
  Team: 'Meet your fictional Northstar team.',
  Settings: 'Make this little workspace yours.',
};
function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
function Pill({ children, color = 'green' }: { children: ReactNode; color?: string }) {
  return <span className={`pill ${color}`}>{children}</span>;
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a[href],[tabindex="0"]',
        ) || [],
      ).filter((el) => !el.hasAttribute('disabled'));
    focusable()[0]?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DemoWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const view = navigation.some((item) => item.name === params.get('view'))
    ? params.get('view')!
    : 'Overview';
  const [state, setState] = useState<DemoState | null>(null);
  const [selected, setSelected] = useState(emails[0].id);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All messages');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<'reset' | 'task' | 'rule' | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState([24, 24]);
  const [workspaceName, setWorkspaceName] = useState('Northstar Business Solutions');
  const [tone, setTone] = useState<(typeof tones)[number]>('Warm and professional');
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  useEffect(() => {
    let data: DemoState;
    try {
      data = restoreState(sessionStorage.getItem(STORAGE_KEY));
    } catch {
      data = freshState();
    }
    setState(data);
    setWorkspaceName(data.settings.name);
    setTone(data.settings.tone);
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (!state) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* The current tab still works when storage is blocked. */
    }
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setStage((previous) => Math.min(previous + 1, 5)), 1200);
    return () => clearInterval(timer);
  }, [busy]);
  const go = (name: string) => {
    router.replace(`/demo?view=${encodeURIComponent(name)}`, { scroll: false });
    setMobileNav(false);
    setError('');
  };
  const log = (previous: DemoState, message: string): DemoState => ({
    ...previous,
    activity: [
      { id: crypto.randomUUID(), message, at: new Date().toISOString() },
      ...previous.activity,
    ].slice(0, 100),
  });
  const openEmail = (id: string) => {
    setSelected(id);
    setError('');
    setState((previous) =>
      previous ? { ...previous, read: Array.from(new Set([...previous.read, id])) } : previous,
    );
    go('Inbox');
  };
  async function processEmail(mode: 'sample' | 'live') {
    if (busy || !state) return;
    const currentEpoch = epoch.current;
    const id = selected;
    setBusy(true);
    setStage(0);
    setError('');
    controller.current = new AbortController();
    try {
      const response = await fetch('/api/demo/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: id, tone: state.settings.tone, mode }),
        signal: controller.current.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'This request could not be completed.');
      if (currentEpoch !== epoch.current) return;
      setState((previous) => (previous ? applyAnalysis(previous, id, data) : previous));
      setToast(
        mode === 'live'
          ? 'Live AI analysis is ready for your review.'
          : 'Illustrative sample loaded. No live model was called.',
      );
    } catch (caught) {
      if (caught instanceof Error && caught.name !== 'AbortError' && currentEpoch === epoch.current)
        setError(caught.message);
    } finally {
      if (currentEpoch === epoch.current) {
        setBusy(false);
        setStage(0);
      }
    }
  }
  if (!state)
    return (
      <main id="main" className="workspace-loading">
        <LoaderCircle className="spin" size={24} /> Preparing your private demo session…
      </main>
    );
  const email = emails.find((item) => item.id === selected)!;
  const result = state.results[selected];
  const pending = Object.entries(state.approvals).filter(([, status]) => status === 'Pending');
  const processed = Object.keys(state.results).length;
  const openTasks = state.tasks.filter((task) => task.status !== 'Done').length;
  const visible = emails.filter(
    (item) =>
      `${item.name} ${item.subject} ${item.intent} ${item.company}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === 'All messages' ||
        (filter === 'Needs review' && state.approvals[item.id] === 'Pending') ||
        (filter === 'Processed' && !!state.results[item.id]) ||
        (filter === 'Unread' && item.unread && !state.read.includes(item.id))),
  );
  const selectedDoc = knowledge.find((doc) => doc.id === documentId);
  function decide(id: string, status: 'Approved' | 'Rejected') {
    setState((previous) =>
      previous
        ? log(
            { ...previous, approvals: { ...previous.approvals, [id]: status } },
            `Draft ${status.toLowerCase()} in the demo. No email was sent.`,
          )
        : previous,
    );
    setToast(
      status === 'Approved'
        ? 'Marked approved in this demo. No email was sent.'
        : 'Draft rejected. You can edit it and submit it for review again.',
    );
  }
  function editDraft(draft: string) {
    setState((previous) =>
      previous && previous.results[selected]
        ? {
            ...previous,
            results: { ...previous.results, [selected]: { ...previous.results[selected], draft } },
            approvals: { ...previous.approvals, [selected]: 'Pending' },
          }
        : previous,
    );
  }
  function taskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') || '').trim();
    if (!title) return;
    const task: DemoTask = {
      id: crypto.randomUUID(),
      title: title.slice(0, 140),
      assignee: String(data.get('assignee')),
      priority: data.get('priority') as DemoTask['priority'],
      status: 'To do',
    };
    setState((previous) =>
      previous && previous.tasks.length < 100
        ? log({ ...previous, tasks: [...previous.tasks, task] }, `Created task: ${title}`)
        : previous,
    );
    setModal(null);
    setToast('Task added to your demo session.');
  }
  function ruleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rule: DemoRule = {
      id: crypto.randomUUID(),
      name: String(data.get('name')).trim().slice(0, 80),
      intent: data.get('intent') as DemoRule['intent'],
      action: data.get('action') as DemoRule['action'],
      enabled: true,
    };
    if (!rule.name) return;
    setState((previous) =>
      previous && previous.rules.length < 20
        ? log(
            { ...previous, rules: [...previous.rules, rule] },
            `Added simulated rule: ${rule.name}`,
          )
        : previous,
    );
    setModal(null);
    setToast('Rule added. It will apply when you process a matching sample.');
  }
  function downloadEstimate() {
    const data = {
      fictional: true,
      currency: 'USD',
      customer: 'Cedar Studio',
      status: 'Draft — requires human review',
      items: [
        { product: 'Atlas Standing Desk', quantity: quantities[0], unitPrice: 420 },
        { product: 'Focus Chair', quantity: quantities[1], unitPrice: 260 },
      ],
      subtotal: fictionalSubtotal([
        { price: 420, quantity: quantities[0] },
        { price: 260, quantity: quantities[1] },
      ]),
      excludes: ['tax', 'shipping'],
      note: 'No order, financial transaction or delivery commitment was created.',
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lizz-fictional-estimate.json';
    link.click();
    URL.revokeObjectURL(url);
    setState((previous) =>
      previous
        ? log(
            previous,
            'Exported a fictional draft estimate. No financial transaction was created.',
          )
        : previous,
    );
  }
  const aiPanel = (
    <div className="analysis-panel">
      <div className="analysis-heading">
        <span className="feature-icon">
          <Sparkles size={19} />
        </span>
        <div>
          <h3>A little intelligence, right here.</h3>
          <p>Understand the message. Shape the next step.</p>
        </div>
      </div>
      {!result && !busy && (
        <div className="analysis-empty">
          <div className="orbit-icon">
            <Sparkles size={32} />
          </div>
          <h3>Let’s connect the dots.</h3>
          <p>
            Classify this fictional email, find the useful details, and draft a contextual response.
          </p>
        </div>
      )}
      {busy && (
        <div className="processing-steps" role="status" aria-live="polite">
          {[
            'Reading the sample',
            'Understanding the intent',
            'Extracting useful details',
            'Referencing business context',
            'Drafting a response',
            'Preparing human review',
          ].map((label, index) => (
            <div className={stage >= index ? 'active' : ''} key={label}>
              {stage > index ? (
                <Check size={15} />
              ) : stage === index ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <span className="step-dot" />
              )}
              {label}
            </div>
          ))}
        </div>
      )}
      {result && !busy && (
        <>
          <div className="analysis-provenance">
            <Pill color={result.provenance === 'live' ? 'green' : 'gray'}>
              {result.provenance === 'live' ? <Zap size={12} /> : <FileText size={12} />}{' '}
              {result.provenance === 'live' ? 'Live AI result' : 'Illustrative sample'}
            </Pill>
            {result.model && <small>{result.model}</small>}
          </div>
          <div className="analysis-classification">
            <Pill>{result.intent}</Pill>
            <Pill color={result.priority === 'High' ? 'amber' : 'gray'}>
              {result.priority} priority
            </Pill>
          </div>
          <p className="analysis-explanation">{result.explanation}</p>
          <div className="confidence">
            <span>Classification confidence</span>
            <b>{Math.round(result.confidence * 100)}%</b>
            <div>
              <i style={{ width: `${result.confidence * 100}%` }} />
            </div>
          </div>
          <h4 className="label-heading">THE USEFUL DETAILS</h4>
          <dl className="extracted-fields">
            {result.extracted.map((field, i) => (
              <div key={i}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
          <h4 className="label-heading">RELEVANT CONTEXT</h4>
          <div className="source-chips">
            {result.sources.map((id) => (
              <button key={id} onClick={() => setDocumentId(id)}>
                <BookOpen size={12} />
                {knowledge.find((doc) => doc.id === id)?.title}
              </button>
            ))}
          </div>
          {result.sources.length === 0 && <p className="muted">No supporting source selected.</p>}
          <div className="suggested-task">
            <SquareCheck size={16} />
            <span>{result.suggestedTask}</span>
          </div>
        </>
      )}
      {error && (
        <div className="error-box" role="alert">
          <CircleHelp size={17} />
          <p>{error}</p>
        </div>
      )}
      <div className="process-actions">
        <button className="button dark" disabled={busy} onClick={() => processEmail('live')}>
          {busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}Run live AI
        </button>
        <button className="button outline" disabled={busy} onClick={() => processEmail('sample')}>
          Use sample response
        </button>
      </div>
      <p className="fine-print">
        Live AI uses a fixed fictional email and reference documents. Daily limits apply. Sample
        responses are illustrative.
      </p>
    </div>
  );

  return (
    <div className="workspace">
      <aside
        className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-brand">
          <Brand light />
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          >
            <X size={20} />
          </button>
          <span className="sidebar-demo">DEMO</span>
        </div>
        <div className="workspace-switch">
          <span className="workspace-monogram">N</span>
          <span>
            <b>{state.settings.name}</b>
            <small>Fictional workspace</small>
          </span>
          <span className="online-dot" />
        </div>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav>
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => go(name)}
              className={view === name ? 'active' : ''}
              aria-current={view === name ? 'page' : undefined}
            >
              <Icon size={17} />
              <span>{name}</span>
              {name === 'Inbox' && <b>{emails.length}</b>}
              {name === 'Approvals' && pending.length > 0 && <b>{pending.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="demo-safety">
            <ShieldCheck size={17} />
            <b>Room to explore.</b>
            <p>Fictional records. No outbound emails. Nothing to break.</p>
            <Link href="/docs">
              About this demo <ArrowUpRight size={12} />
            </Link>
          </div>
          <button className="sidebar-reset" onClick={() => setModal('reset')}>
            <RotateCcw size={15} />
            Reset demo
          </button>
          <div className="demo-user">
            <span className="avatar sage">Y</span>
            <div>
              <b>You, exploring</b>
              <small>Private demo session</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={12} />
              <b>{view}</b>
            </span>
          </div>
          <div className="topbar-right">
            <span className="topbar-safe">
              <span className="online-dot" />
              Safe demo environment
            </span>
            <Link href="/docs" className="subtle-link">
              Product notes <ArrowUpRight size={13} />
            </Link>
            <Link href="/" className="icon-button" aria-label="Back to website">
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </header>
        <div className="demo-banner">
          <span>
            <Sparkles size={14} />
            <b>Your inbox, with a little more possibility.</b> Everything here is fictional. Explore
            freely.
          </span>
          <button onClick={() => setModal('reset')}>
            Start fresh <RotateCcw size={12} />
          </button>
        </div>
        <main id="main" className={`workspace-page ${view === 'Inbox' ? 'inbox-page' : ''}`}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">NORTHSTAR · DEMO WORKSPACE</span>
              <h1>
                {view === 'Overview'
                  ? 'A little room to breathe.'
                  : view === 'Inbox'
                    ? 'Your inbox, in focus.'
                    : view === 'AI studio'
                      ? 'From message to momentum.'
                      : view}
              </h1>
              <p>{descriptions[view]}</p>
            </div>
            {view === 'Overview' ? (
              <button className="button dark" onClick={() => openEmail(emails[0].id)}>
                <Inbox size={15} />
                Open your inbox <ArrowRight size={15} />
              </button>
            ) : view === 'Tasks' ? (
              <button
                disabled={state.tasks.length >= 100}
                className="button dark"
                onClick={() => setModal('task')}
              >
                <Plus size={16} />
                New task
              </button>
            ) : view === 'Automations' ? (
              <button
                disabled={state.rules.length >= 20}
                className="button dark"
                onClick={() => setModal('rule')}
              >
                <Plus size={16} />
                New rule
              </button>
            ) : (
              <span className="demo-data-tag">FICTIONAL DEMO DATA</span>
            )}
          </div>

          {view === 'Overview' && (
            <>
              <div className="welcome-card">
                <div>
                  <span className="eyebrow">MEET YOUR NEW FLOW</span>
                  <h2>
                    Good work starts
                    <br />
                    with a clear next step.
                  </h2>
                  <p>
                    Seven conversations. A few useful details.
                    <br />A whole lot less to keep in your head.
                  </p>
                  <button
                    className="inline-link"
                    onClick={() => {
                      setSelected(emails[0].id);
                      go('AI studio');
                    }}
                  >
                    Try your first AI workflow <ArrowRight size={16} />
                  </button>
                </div>
                <div className="welcome-graphic" aria-hidden="true">
                  <div className="graphic-ring ring-one" />
                  <div className="graphic-ring ring-two" />
                  <span className="graphic-mail">
                    <MailIcon />
                  </span>
                  <span className="graphic-tag">
                    <Sparkles size={15} /> Intent understood
                  </span>
                  <span className="graphic-task">
                    <SquareCheck size={15} /> Next step, found.
                  </span>
                  <span className="graphic-spark">✳</span>
                </div>
              </div>
              <div className="metrics-grid">
                {[
                  {
                    name: 'Inbox conversations',
                    value: emails.length,
                    icon: Inbox,
                    note: 'Fictional sample messages',
                  },
                  {
                    name: 'AI analyses ready',
                    value: processed,
                    icon: Sparkles,
                    note: 'Processed in your session',
                  },
                  {
                    name: 'Waiting for your review',
                    value: pending.length,
                    icon: ShieldCheck,
                    note: 'Every draft stays under your control',
                  },
                  {
                    name: 'Open tasks',
                    value: openTasks,
                    icon: SquareCheck,
                    note: 'Across the demo team',
                  },
                ].map(({ name, value, icon: Icon, note }) => (
                  <div className="metric-card" key={name}>
                    <div>
                      <span>{name}</span>
                      <Icon size={17} />
                    </div>
                    <strong>{value.toString().padStart(2, '0')}</strong>
                    <small>{note}</small>
                  </div>
                ))}
              </div>
              <div className="overview-columns">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">CONVERSATIONS WITH POTENTIAL</span>
                      <h3>A few things worth your attention.</h3>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="View inbox"
                      onClick={() => go('Inbox')}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  {emails.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      className="overview-email"
                      onClick={() => openEmail(item.id)}
                    >
                      <span className={`avatar ${item.color}`}>{item.initials}</span>
                      <span>
                        <b>{item.name}</b>
                        <p>{item.subject}</p>
                      </span>
                      <Pill color={item.priority === 'High' ? 'amber' : 'gray'}>{item.intent}</Pill>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </section>
                <section className="panel inbox-mix">
                  <span className="eyebrow">A LITTLE PERSPECTIVE</span>
                  <h3>What’s in this inbox?</h3>
                  <p className="muted">Intent distribution across seven fictional messages.</p>
                  <div className="mix-bar">
                    {emails.map((item, i) => (
                      <span
                        key={item.id}
                        style={{
                          background: [
                            '#345c49',
                            '#86a88a',
                            '#c9d9b5',
                            '#d4a876',
                            '#afa4c3',
                            '#738f78',
                            '#e9dfca',
                          ][i],
                          flex: 1,
                        }}
                      />
                    ))}
                  </div>
                  {[
                    'Sales & quotations',
                    'Support & complaints',
                    'Products & follow-ups',
                    'General inquiries',
                  ].map((label, i) => (
                    <div className="mix-label" key={label}>
                      <span>
                        <i
                          style={{ background: ['#345c49', '#86a88a', '#c9d9b5', '#d4a876'][i] }}
                        />
                        {label}
                      </span>
                      <b>{i === 3 ? '1' : '2'}</b>
                    </div>
                  ))}
                  <div className="small-insight">
                    <Sparkles size={16} />
                    <p>
                      Start with Jamie’s quote request to see how Lizz brings the details together.
                    </p>
                  </div>
                </section>
              </div>
              <section className="panel quick-start">
                <div>
                  <span className="eyebrow">YOUR FIRST FIVE MINUTES</span>
                  <h3>A good place to begin.</h3>
                </div>
                {[
                  {
                    name: 'Read a conversation',
                    description: 'Explore the sample inbox',
                    view: 'Inbox',
                    icon: Inbox,
                  },
                  {
                    name: 'Connect the dots',
                    description: 'Run a live AI analysis',
                    view: 'AI studio',
                    icon: Sparkles,
                  },
                  {
                    name: 'Make the final call',
                    description: 'Review a suggested draft',
                    view: 'Approvals',
                    icon: ShieldCheck,
                  },
                ].map(({ name, description, view: next, icon: Icon }) => (
                  <button key={name} onClick={() => go(next)}>
                    <Icon size={20} />
                    <span>
                      <b>{name}</b>
                      <small>{description}</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </section>
            </>
          )}

          {view === 'Inbox' && (
            <>
              <div className="inbox-controls">
                <div className="inbox-tabs">
                  {['All messages', 'Needs review', 'Processed', 'Unread'].map((tab) => (
                    <button
                      key={tab}
                      className={filter === tab ? 'active' : ''}
                      onClick={() => setFilter(tab)}
                    >
                      {tab}
                      {tab === 'All messages' && <span>{emails.length}</span>}
                    </button>
                  ))}
                </div>
                <label className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search inbox"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find a conversation…"
                  />
                </label>
              </div>
              <div className="inbox-layout">
                <section className="email-list" aria-label="Email conversations">
                  {visible.length === 0 ? (
                    <div className="empty-state">
                      <Search size={26} />
                      <h3>A little quiet here.</h3>
                      <p>No conversations match this view.</p>
                      <button
                        className="button outline small"
                        onClick={() => {
                          setSearch('');
                          setFilter('All messages');
                        }}
                      >
                        Show all messages
                      </button>
                    </div>
                  ) : (
                    visible.map((item) => (
                      <button
                        key={item.id}
                        className={`email-row ${selected === item.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelected(item.id);
                          setError('');
                          setState((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  read: Array.from(new Set([...previous.read, item.id])),
                                }
                              : previous,
                          );
                        }}
                      >
                        <span className={`avatar ${item.color}`}>{item.initials}</span>
                        <span className="email-row-content">
                          <span className="sender-line">
                            <b>{item.name}</b>
                            <small>{item.time}</small>
                          </span>
                          <strong>{item.subject}</strong>
                          <p>{item.body.replace(/\n/g, ' ').slice(0, 86)}…</p>
                          <span className="email-row-bottom">
                            <span className="mini-pill">{item.intent}</span>
                            {item.unread && !state.read.includes(item.id) && (
                              <span className="unread-dot" aria-label="Unread" />
                            )}
                            {state.results[item.id] && <Sparkles size={12} />}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </section>
                <section className="email-reading" aria-label="Selected email">
                  <div className="message-tags">
                    <Pill color={email.priority === 'High' ? 'amber' : 'gray'}>
                      {email.priority} priority
                    </Pill>
                    <span className="fine-print">Fictional conversation</span>
                  </div>
                  <h2>{email.subject}</h2>
                  <div className="message-person">
                    <span className={`avatar ${email.color}`}>{email.initials}</span>
                    <div>
                      <b>{email.name}</b>
                      <small>{email.email}</small>
                    </div>
                    <span>{email.time}</span>
                  </div>
                  <div className="message-body">{email.body}</div>
                  <div className="message-divider" />
                  {result ? (
                    <DraftBox
                      result={result}
                      status={state.approvals[selected]}
                      onEdit={editDraft}
                      onApprove={() => decide(selected, 'Approved')}
                      onReject={() => decide(selected, 'Rejected')}
                    />
                  ) : (
                    <div className="draft-nudge">
                      <Sparkles size={18} />
                      <div>
                        <b>A thoughtful reply starts here.</b>
                        <p>Run an analysis to bring the context together.</p>
                      </div>
                    </div>
                  )}
                </section>
                <aside className="inbox-ai">{aiPanel}</aside>
              </div>
            </>
          )}

          {view === 'AI studio' && (
            <div className="studio-layout">
              <div className="panel studio-email">
                <span className="eyebrow">01 · PICK A CONVERSATION</span>
                <h2>Something worth understanding.</h2>
                <label className="field-label">
                  Fictional sample email
                  <select
                    value={selected}
                    onChange={(event) => {
                      setSelected(event.target.value);
                      setError('');
                    }}
                  >
                    {emails.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {item.intent}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="studio-message">
                  <div className="message-person">
                    <span className={`avatar ${email.color}`}>{email.initials}</span>
                    <div>
                      <b>{email.name}</b>
                      <small>{email.email}</small>
                    </div>
                  </div>
                  <h3>{email.subject}</h3>
                  <div className="message-body">{email.body}</div>
                </div>
                <div className="safety-note">
                  <ShieldCheck size={17} />
                  <p>
                    Only this fixed fictional message and the demo reference documents go to the
                    model. No real mailbox is connected.
                  </p>
                </div>
              </div>
              <section className="panel studio-analysis">
                <span className="eyebrow">02 · CONNECT THE DOTS</span>
                {aiPanel}
              </section>
              {result && (
                <section className="panel studio-draft">
                  <span className="eyebrow">03 · MAKE IT YOURS</span>
                  <DraftBox
                    result={result}
                    status={state.approvals[selected]}
                    onEdit={editDraft}
                    onApprove={() => decide(selected, 'Approved')}
                    onReject={() => decide(selected, 'Rejected')}
                  />
                </section>
              )}
            </div>
          )}

          {view === 'Tasks' && (
            <>
              <div className="section-note">
                <SquareCheck size={17} />
                <span>
                  These assignments stay in your demo session. No team members are notified.
                </span>
              </div>
              <div className="task-board">
                {(['To do', 'In progress', 'Done'] as const).map((status) => (
                  <section className="task-column" key={status}>
                    <div className="task-column-heading">
                      <h3>
                        <span className={`status-dot ${status === 'Done' ? 'complete' : ''}`} />
                        {status}
                      </h3>
                      <span>{state.tasks.filter((task) => task.status === status).length}</span>
                    </div>
                    {state.tasks
                      .filter((task) => task.status === status)
                      .map((task) => (
                        <article className="task-card" key={task.id}>
                          <div>
                            <Pill color={task.priority === 'High' ? 'amber' : 'gray'}>
                              {task.priority}
                            </Pill>
                            <button
                              className="icon-button"
                              aria-label={`Delete task ${task.title}`}
                              onClick={() =>
                                setState((previous) =>
                                  previous
                                    ? log(
                                        {
                                          ...previous,
                                          tasks: previous.tasks.filter(
                                            (item) => item.id !== task.id,
                                          ),
                                        },
                                        'Removed a demo task.',
                                      )
                                    : previous,
                                )
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <h4>{task.title}</h4>
                          <label className="task-assignee">
                            Assigned to
                            <select
                              aria-label={`Assignee for ${task.title}`}
                              value={task.assignee}
                              onChange={(event) =>
                                setState((previous) =>
                                  previous
                                    ? log(
                                        {
                                          ...previous,
                                          tasks: previous.tasks.map((item) =>
                                            item.id === task.id
                                              ? { ...item, assignee: event.target.value }
                                              : item,
                                          ),
                                        },
                                        'Changed a demo task assignment.',
                                      )
                                    : previous,
                                )
                              }
                            >
                              {team.map((member) => (
                                <option key={member.id}>{member.name}</option>
                              ))}
                            </select>
                          </label>
                          {task.emailId && (
                            <button
                              className="task-source"
                              onClick={() => openEmail(task.emailId!)}
                            >
                              <Inbox size={12} />
                              View conversation <ArrowUpRight size={12} />
                            </button>
                          )}
                          <label className="task-state">
                            Status
                            <select
                              aria-label={`Status for ${task.title}`}
                              value={task.status}
                              onChange={(event) =>
                                setState((previous) =>
                                  previous
                                    ? log(
                                        {
                                          ...previous,
                                          tasks: previous.tasks.map((item) =>
                                            item.id === task.id
                                              ? {
                                                  ...item,
                                                  status: event.target.value as DemoTask['status'],
                                                }
                                              : item,
                                          ),
                                        },
                                        `Moved a demo task to ${event.target.value}.`,
                                      )
                                    : previous,
                                )
                              }
                            >
                              {['To do', 'In progress', 'Done'].map((value) => (
                                <option key={value}>{value}</option>
                              ))}
                            </select>
                          </label>
                        </article>
                      ))}
                    {state.tasks.filter((task) => task.status === status).length === 0 && (
                      <p className="column-empty">A little room for what’s next.</p>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}

          {view === 'Approvals' && (
            <>
              <div className="section-note">
                <ShieldCheck size={17} />
                <span>Review is always required. Approving a draft here never sends an email.</span>
              </div>
              {processed === 0 ? (
                <Empty
                  icon={<ShieldCheck size={30} />}
                  title="Good judgment needs a first draft."
                  text="Process a fictional email in the AI studio, then come back to review the suggested reply."
                  action={() => go('AI studio')}
                  label="Open AI studio"
                />
              ) : (
                <div className="approval-grid">
                  {Object.entries(state.results).map(([id, analysis]) => (
                    <article key={id} className="panel approval-item">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">
                            {emails.find((item) => item.id === id)?.name}
                          </span>
                          <h3>{emails.find((item) => item.id === id)?.subject}</h3>
                        </div>
                        <Pill
                          color={
                            state.approvals[id] === 'Approved'
                              ? 'green'
                              : state.approvals[id] === 'Rejected'
                                ? 'gray'
                                : 'amber'
                          }
                        >
                          {state.approvals[id] || 'Pending'}
                        </Pill>
                      </div>
                      <p className="approval-draft-text">{analysis.draft}</p>
                      <div className="approval-item-actions">
                        <button
                          className="button dark small"
                          disabled={state.approvals[id] === 'Approved'}
                          onClick={() => decide(id, 'Approved')}
                        >
                          <Check size={14} />
                          Approve in demo
                        </button>
                        <button className="button outline small" onClick={() => openEmail(id)}>
                          Edit draft
                        </button>
                        <button
                          className="button text small"
                          disabled={state.approvals[id] === 'Rejected'}
                          onClick={() => decide(id, 'Rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {view === 'Knowledge' && (
            <>
              <div className="section-note">
                <BookOpen size={17} />
                <span>
                  These four fictional documents provide the context for AI drafts. This public
                  release accepts no document uploads.
                </span>
              </div>
              <div className="knowledge-grid">
                {knowledge.map((doc) => (
                  <button
                    className="panel knowledge-card"
                    key={doc.id}
                    onClick={() => setDocumentId(doc.id)}
                  >
                    <span className="document-icon">
                      <FileText size={25} />
                    </span>
                    <Pill color="gray">Fictional reference</Pill>
                    <h3>{doc.title}</h3>
                    <p>{doc.content.slice(0, 145)}…</p>
                    <span className="document-footer">
                      <span>{doc.type}</span>
                      <ArrowUpRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="knowledge-note">
                <Sparkles size={20} />
                <div>
                  <h3>Context you can inspect.</h3>
                  <p>
                    Each AI result lists the reference documents it used. Open a source from the
                    analysis panel to see exactly what was available. This demo uses a fixed context
                    set; it does not claim to run a live vector database.
                  </p>
                </div>
              </div>
            </>
          )}

          {view === 'Automations' && (
            <>
              <div className="section-note">
                <Workflow size={17} />
                <span>
                  Rules run locally after an analysis. Review requirements remain in place, even if
                  a rule is disabled.
                </span>
              </div>
              <div className="rule-list">
                {state.rules.map((rule) => (
                  <article className="panel rule-card" key={rule.id}>
                    <span className="feature-icon">
                      <Workflow size={20} />
                    </span>
                    <div>
                      <h3>{rule.name}</h3>
                      <p>
                        When intent is <b>{rule.intent}</b>
                        <ArrowRight size={13} />
                        <span>{rule.action}</span>
                      </p>
                    </div>
                    <button
                      className={`toggle ${rule.enabled ? 'on' : ''}`}
                      role="switch"
                      aria-checked={rule.enabled}
                      aria-label={`Enable ${rule.name}`}
                      onClick={() =>
                        setState((previous) =>
                          previous
                            ? log(
                                {
                                  ...previous,
                                  rules: previous.rules.map((item) =>
                                    item.id === rule.id
                                      ? { ...item, enabled: !item.enabled }
                                      : item,
                                  ),
                                },
                                `${rule.enabled ? 'Disabled' : 'Enabled'} simulated rule: ${rule.name}`,
                              )
                            : previous,
                        )
                      }
                    >
                      <span />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete rule ${rule.name}`}
                      onClick={() =>
                        setState((previous) =>
                          previous
                            ? log(
                                {
                                  ...previous,
                                  rules: previous.rules.filter((item) => item.id !== rule.id),
                                },
                                'Removed a simulated rule.',
                              )
                            : previous,
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </div>
              <p className="fine-print">
                “Create task” adds one task per conversation. “Request approval” queues a review;
                all drafts require review anyway. “Flag for review” records a review flag in
                Activity. No provider writes occur.
              </p>
            </>
          )}

          {view === 'Estimates' && (
            <div className="estimate-layout">
              <section className="panel estimate-sheet">
                <div className="estimate-head">
                  <div>
                    <span className="eyebrow">NORTHSTAR · FICTIONAL ESTIMATE</span>
                    <h2>A new studio, taking shape.</h2>
                    <p>Prepared for Cedar Studio · Draft NS-DEMO-001</p>
                  </div>
                  <Pill color="amber">Draft for review</Pill>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>PRODUCT</th>
                        <th>QTY</th>
                        <th>UNIT PRICE</th>
                        <th>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'Atlas Standing Desk', price: 420 },
                        { name: 'Focus Chair', price: 260 },
                      ].map((item, i) => (
                        <tr key={item.name}>
                          <td>
                            <b>{item.name}</b>
                            <small>Fictional catalog item</small>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              aria-label={`${item.name} quantity`}
                              value={quantities[i]}
                              onChange={(event) =>
                                setQuantities((previous) =>
                                  previous.map((value, index) =>
                                    index === i
                                      ? Math.max(1, Math.min(100, Number(event.target.value) || 1))
                                      : value,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td>{money(item.price)}</td>
                          <td>{money(item.price * quantities[i])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="estimate-total">
                  <span>Illustrative subtotal</span>
                  <strong>
                    {money(
                      fictionalSubtotal([
                        { price: 420, quantity: quantities[0] },
                        { price: 260, quantity: quantities[1] },
                      ]),
                    )}
                  </strong>
                </div>
                <p className="fine-print">
                  Fictional USD prices. Tax and shipping are excluded. No discounts, inventory
                  levels or delivery dates have been confirmed. This is not an offer or a financial
                  transaction.
                </p>
                <button className="button dark" onClick={downloadEstimate}>
                  <Download size={16} />
                  Export fictional draft
                </button>
              </section>
              <aside className="panel estimate-context">
                <span className="feature-icon">
                  <Sparkles size={22} />
                </span>
                <h3>From a conversation.</h3>
                <p>
                  Jamie asked about furnishing a new studio. The quantities come from the email; the
                  prices come from the fictional catalog.
                </p>
                <button className="inline-link" onClick={() => openEmail('email-quote')}>
                  View original request <ArrowUpRight size={15} />
                </button>
                <div className="message-divider" />
                <ShieldCheck size={22} />
                <h4>Still a human decision.</h4>
                <p>
                  A person must verify the quote, pricing and delivery details. No Books account is
                  connected.
                </p>
              </aside>
            </div>
          )}

          {view === 'Activity' && (
            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">YOUR SESSION’S STORY</span>
                  <h3>Every little step, in view.</h3>
                </div>
                <Pill color="gray">{state.activity.length} events</Pill>
              </div>
              {state.activity.map((event) => (
                <div className="activity-event" key={event.id}>
                  <span className="activity-line-dot" />
                  <div>
                    <p>{event.message}</p>
                    <small>
                      {new Date(event.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · This demo session
                    </small>
                  </div>
                  <CheckCheck size={15} />
                </div>
              ))}
            </section>
          )}

          {view === 'Integrations' && (
            <>
              <div className="section-note">
                <ShieldCheck size={17} />
                <span>
                  All real account connections were excluded from this public deployment. There are
                  no OAuth or mail-sending endpoints.
                </span>
              </div>
              <div className="integrations-grid">
                {[
                  {
                    name: 'Zoho Mail',
                    letter: 'Z',
                    description:
                      'The original mail adapter remains outside this public runtime. No Zoho account is connected.',
                    color: 'peach',
                  },
                  {
                    name: 'Zoho Books',
                    letter: 'Z',
                    description:
                      'Estimates in this demo are fictional drafts. No accounting system or financial writes are available.',
                    color: 'sage',
                  },
                  {
                    name: 'Google Workspace',
                    letter: 'G',
                    description:
                      'Real Gmail account connection is unavailable in this demo. Every inbox record is fictional.',
                    color: 'lavender',
                  },
                  {
                    name: 'Microsoft 365',
                    letter: 'M',
                    description:
                      'Future integration. No Outlook connection or synchronization is implemented here.',
                    color: 'sand',
                  },
                ].map((item) => (
                  <article className="panel integration-card" key={item.name}>
                    <span className={`integration-logo ${item.color}`}>{item.letter}</span>
                    <Pill color="gray">Not connected</Pill>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <span className="integration-state">
                      <Plug size={14} />
                      Unavailable in public demo
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}

          {view === 'Team' && (
            <>
              <div className="section-note">
                <Users size={17} />
                <span>
                  A fictional team for exploring assignments. No real identities, invitations or
                  emails are used.
                </span>
              </div>
              <div className="panel team-panel">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>TEAM MEMBER</th>
                        <th>ROLE</th>
                        <th>DEMO ADDRESS</th>
                        <th>OPEN TASKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((member, i) => (
                        <tr key={member.id}>
                          <td>
                            <span className={`avatar ${['sage', 'peach', 'lavender'][i]}`}>
                              {member.initials}
                            </span>
                            <b>{member.name}</b>
                          </td>
                          <td>{member.role}</td>
                          <td>{member.id}@northstar.example.com</td>
                          <td>
                            {
                              state.tasks.filter(
                                (task) => task.assignee === member.name && task.status !== 'Done',
                              ).length
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {view === 'Settings' && (
            <div className="settings-layout">
              <form
                className="panel settings-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!workspaceName.trim()) return;
                  setState((previous) =>
                    previous
                      ? log(
                          {
                            ...previous,
                            settings: {
                              name: workspaceName.trim().slice(0, 80),
                              tone,
                              review: true,
                            },
                          },
                          'Updated local demo workspace settings.',
                        )
                      : previous,
                  );
                  setToast('Your demo preferences are saved in this tab.');
                }}
              >
                <span className="eyebrow">THE LITTLE DETAILS</span>
                <h2>Make space for your style.</h2>
                <label className="field-label">
                  Demo workspace name
                  <input
                    maxLength={80}
                    required
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                  />
                </label>
                <label className="field-label">
                  AI response style
                  <select
                    value={tone}
                    onChange={(event) => setTone(event.target.value as (typeof tones)[number])}
                  >
                    {tones.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <div className="fixed-setting">
                  <ShieldCheck size={19} />
                  <div>
                    <b>Human review is always required</b>
                    <p>This safeguard cannot be disabled in the public demo.</p>
                  </div>
                  <Pill>Always on</Pill>
                </div>
                <p className="fine-print">
                  Workspace names stay in your browser. Live AI receives only the selected response
                  style and the fixed fictional email context.
                </p>
                <button className="button dark" type="submit">
                  <Check size={15} />
                  Save preferences
                </button>
              </form>
              <aside className="panel settings-aside">
                <h3>A clean slate, anytime.</h3>
                <p>
                  Reset clears your demo tasks, drafts, approvals, settings and activity. Your daily
                  live AI allowance remains unchanged.
                </p>
                <button className="button outline" onClick={() => setModal('reset')}>
                  <RotateCcw size={15} />
                  Reset this demo
                </button>
                <div className="message-divider" />
                <Link href="/privacy" className="inline-link">
                  Privacy details <ArrowUpRight size={15} />
                </Link>
                <Link href="/docs" className="inline-link">
                  Customer workspace availability <ArrowUpRight size={15} />
                </Link>
              </aside>
            </div>
          )}
        </main>
        <footer className="workspace-footer">
          <span>
            <ShieldCheck size={12} /> A fictional workspace. A real sense of possibility.
          </span>
          <Link href="/privacy">Demo privacy</Link>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            className="icon-button"
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === 'reset' && (
        <Modal title="A fresh little start?" onClose={() => setModal(null)}>
          <p>
            Reset the demo’s tasks, drafts, approvals, rules and preferences in this tab. Your daily
            live AI allowance will stay the same.
          </p>
          <div className="modal-actions">
            <button className="button outline" onClick={() => setModal(null)}>
              Keep exploring
            </button>
            <button
              className="button dark"
              onClick={() => {
                epoch.current++;
                controller.current?.abort();
                setBusy(false);
                setState(freshState());
                setWorkspaceName('Northstar Business Solutions');
                setTone('Warm and professional');
                setSelected(emails[0].id);
                setSearch('');
                setFilter('All messages');
                setQuantities([24, 24]);
                setError('');
                setModal(null);
                setToast('Your demo is fresh and ready.');
              }}
            >
              <RotateCcw size={15} />
              Reset demo
            </button>
          </div>
        </Modal>
      )}
      {modal === 'task' && (
        <Modal title="A new next step." onClose={() => setModal(null)}>
          <form onSubmit={taskSubmit}>
            <label className="field-label">
              Task title
              <input
                name="title"
                required
                maxLength={140}
                placeholder="What needs to happen next?"
              />
            </label>
            <label className="field-label">
              Assignee
              <select name="assignee">
                {team.map((member) => (
                  <option key={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Priority
              <select name="priority">
                {['Normal', 'High', 'Low'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <p className="fine-print">This creates a local demo task. No one will be notified.</p>
            <button type="submit" className="button dark">
              <Plus size={15} />
              Create demo task
            </button>
          </form>
        </Modal>
      )}
      {modal === 'rule' && (
        <Modal title="A little rule for a smoother day." onClose={() => setModal(null)}>
          <form onSubmit={ruleSubmit}>
            <label className="field-label">
              Rule name
              <input name="name" required maxLength={80} placeholder="Give your rule a name" />
            </label>
            <label className="field-label">
              When the intent is
              <select name="intent">
                {intents.map((intent) => (
                  <option key={intent}>{intent}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Then
              <select name="action">
                {['Request approval', 'Create task', 'Flag for review'].map((action) => (
                  <option key={action}>{action}</option>
                ))}
              </select>
            </label>
            <p className="fine-print">
              Applies to the next matching analysis. Every action stays inside this demo.
            </p>
            <button className="button dark" type="submit">
              <Plus size={15} />
              Add demo rule
            </button>
          </form>
        </Modal>
      )}
      {selectedDoc && (
        <Modal title={selectedDoc.title} onClose={() => setDocumentId(null)}>
          <Pill color="gray">Fictional reference document</Pill>
          <p className="document-full">{selectedDoc.content}</p>
          <div className="safety-note">
            <BookOpen size={17} />
            <p>
              This fixed fictional reference is available to the AI. No private documents or live
              vector database are connected.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
function MailIcon() {
  return <Inbox size={45} strokeWidth={1.2} />;
}
function Empty({
  icon,
  title,
  text,
  action,
  label,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: () => void;
  label: string;
}) {
  return (
    <div className="panel empty-state large">
      <span className="empty-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="button dark" onClick={action}>
        {label}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function DraftBox({
  result,
  status,
  onEdit,
  onApprove,
  onReject,
}: {
  result: AnalysisResult;
  status?: string;
  onEdit: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="draft-box">
      <div className="draft-heading">
        <span>
          <Sparkles size={16} />
          <b>A thoughtful first draft.</b>
        </span>
        <Pill color={status === 'Approved' ? 'green' : status === 'Rejected' ? 'gray' : 'amber'}>
          {status === 'Approved'
            ? 'Approved in demo'
            : status === 'Rejected'
              ? 'Rejected'
              : 'Needs review'}
        </Pill>
      </div>
      <textarea
        aria-label="Edit suggested reply"
        value={result.draft}
        maxLength={2400}
        onChange={(event) => onEdit(event.target.value)}
      />
      <div className="draft-actions">
        <button
          className="button dark small"
          disabled={status === 'Approved' || result.draft.trim().length < 10}
          onClick={onApprove}
        >
          <Check size={14} />
          Approve in demo
        </button>
        <button className="button text small" disabled={status === 'Rejected'} onClick={onReject}>
          Reject draft
        </button>
      </div>
      <p className="fine-print">
        <ShieldCheck size={12} /> Approvals are simulated. No email is sent.
      </p>
    </div>
  );
}
