import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Brand } from './brand';
export function InfoPage({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="simple-header">
        <Brand />
        <Link className="button outline small" href="/demo">
          Explore the demo <ArrowUpRight size={14} />
        </Link>
      </header>
      <main id="main" className="simple-page">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="simple-footer">
        <Link href="/">Lizz home</Link> · <Link href="/privacy">Privacy</Link> ·{' '}
        <Link href="/terms">Demo terms</Link>
      </footer>
    </>
  );
}
