import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="simple-page">
      <p className="eyebrow">404 · A SMALL DETOUR</p>
      <h1>This page wandered off.</h1>
      <p>Your calmer inbox is still right here.</p>
      <Link href="/demo" className="button dark">
        Open the demo →
      </Link>
    </main>
  );
}
