import { Suspense } from 'react';
import { DemoWorkspace } from '@/components/demo-workspace';
export const metadata = { title: 'Explore the demo', robots: { index: false, follow: true } };
export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <main id="main" className="workspace-loading">
          Getting your calmer inbox ready…
        </main>
      }
    >
      <DemoWorkspace />
    </Suspense>
  );
}
