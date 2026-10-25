import Link from 'next/link';
import { InfoPage } from '@/components/info-page';
export const metadata = { title: 'Product notes' };
export default function Docs() {
  return (
    <InfoPage title="What you can try today." eyebrow="LIZZ · PRODUCT NOTES">
      <div className="status-callout">
        <p>
          <strong>Public demo available. Customer workspaces are not yet open.</strong>
        </p>
        <p>
          The current release focuses on a safe, useful demonstration with working Gemini inference
          and completely fictional business records.
        </p>
      </div>
      <h2>Take a small tour</h2>
      <ol>
        <li>
          Open the <Link href="/demo?view=Inbox">inbox</Link> and select Jamie’s quote request.
        </li>
        <li>
          Use “Run live AI” to classify the message, extract details and generate a contextual
          draft.
        </li>
        <li>Open a source document to inspect the reference behind the reply.</li>
        <li>Edit the draft, then approve or reject it in the demo. No message is sent.</li>
        <li>Move a task between statuses, change its assignee and add a task of your own.</li>
        <li>Adjust quantities in the fictional estimate and export a draft.</li>
        <li>Add a simulated automation rule and run a matching email analysis.</li>
        <li>Review Activity, then reset to start fresh.</li>
      </ol>
      <h2>Live AI and sample mode</h2>
      <p>
        Live inference uses the configured Gemini model on the server. It accepts only the seven
        fictional emails and three preset tones. The release defaults to 40 model requests per UTC
        day across the entire demo and three per visitor network. Each request has an output limit
        and timeout. The UI labels live results and illustrative samples separately.
      </p>
      <h2>What is simulated</h2>
      <p>
        Tasks, approvals, rules, activity, estimates and team assignments work inside a private
        browser session. They do not contact anyone. Every draft requires review. The four reference
        documents are supplied as fixed AI context; this public release does not run Qdrant
        retrieval or background workers.
      </p>
      <h2>What is unavailable</h2>
      <p>
        Signup, login, customer organizations, invitations, real mailbox sync, OAuth connections,
        financial writes, billing and production document upload are unavailable in this demo.
        Integration cards accurately show “Not connected.”
      </p>
      <h2>Architecture</h2>
      <p>
        This deployment is a separate Next.js and React application. The public AI endpoint
        validates a strict request schema, selects its own synthetic context, reserves a durable
        usage slot in private Vercel Blob storage, calls Gemini once and validates the result.
        Provider errors are sanitized. It imports no legacy mailbox, database, scheduler or
        integration modules.
      </p>
      <h2>From Maxine to Lizz</h2>
      <p>
        Lizz is the public-facing name. The old application is retained separately for its operator,
        while the demo contains newly authored fictional records. Production customer onboarding
        will require verified tenant isolation, a separate database, maintained authentication,
        organization-owned integrations and end-to-end release testing.
      </p>
    </InfoPage>
  );
}
