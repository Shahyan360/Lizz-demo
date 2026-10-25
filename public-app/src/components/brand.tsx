import Link from 'next/link';
export function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M9 6v13a7 7 0 0 0 7 7h9M16 6v12a2 2 0 0 0 2 2h7"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="25" cy="7" r="3" fill="currentColor" />
      </svg>
    </span>
  );
}
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="Lizz home">
      <Mark />
      <span>
        lizz<span className="brand-period">.</span>
      </span>
    </Link>
  );
}
