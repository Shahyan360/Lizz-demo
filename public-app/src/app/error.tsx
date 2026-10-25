'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="simple-page">
      <h1>Let’s try that again.</h1>
      <p>The demo couldn’t load this page. Your real accounts are not connected.</p>
      <button className="button dark" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
