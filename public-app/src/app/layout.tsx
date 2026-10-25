import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Lizz — A calmer kind of inbox', template: '%s · Lizz' },
  description:
    'Turn incoming emails into clear next steps. Explore Lizz’s interactive demo with fictional emails, AI drafts, tasks and human review.',
  applicationName: 'Lizz',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Lizz — Less inbox. More possibility.',
    description: 'Your inbox, thoughtfully connected to your work. Try the public AI demo.',
    type: 'website',
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <Script src="/portfolio-embed.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
