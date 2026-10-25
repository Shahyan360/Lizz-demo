import { InfoPage } from '@/components/info-page';
export const metadata = { title: 'Demo privacy' };
export default function Privacy() {
  return (
    <InfoPage
      title="A small footprint. A clear explanation."
      eyebrow="DEMO PRIVACY · UPDATED OCTOBER 25, 2026"
    >
      <p>
        This public Lizz release is an interactive demonstration. Northstar Business Solutions, its
        people, customer conversations, prices, orders and documents are fictional. Every contact
        uses a reserved example domain.
      </p>
      <h2>Your demo session</h2>
      <p>
        Tasks, draft edits, approvals, settings and activity stay in this tab’s browser session
        storage for up to 12 hours. Reset clears them. They are not sent to another visitor or
        stored in a company database. Browser settings and restoring closed tabs can affect session
        storage lifetime.
      </p>
      <h2>When you use live AI</h2>
      <p>
        The server sends the selected fixed fictional email, four fictional reference documents and
        a preset response style to Google’s Gemini API. It does not send your workspace name, task
        text or draft edits. There is no free-text prompt box and no document upload. Google
        processes the API request under the terms applying to the owner’s API account.
      </p>
      <p>
        Live AI results are returned to your browser. Provider failures and quota limits are shown
        clearly. Choosing a sample response uses deterministic illustrative output and does not call
        the AI provider.
      </p>
      <h2>Limits and infrastructure</h2>
      <p>
        A separate private Vercel Blob store holds tiny quota markers. A daily keyed hash of your
        network address helps enforce a per-network allowance; the application does not store the
        raw address in that store. Quota markers are scheduled for deletion after three days. Failed
        provider calls may consume an allowance. Vercel handles hosting and request logs, which may
        include IP addresses and standard request metadata under its own retention policies.
      </p>
      <p>
        Application logs include an event name, provider model or general error category. We do not
        log email bodies, generated drafts, credentials or your browser’s local edits. No marketing
        analytics, tracking cookies or advertising pixels have been added.
      </p>
      <h2>Connections and actions</h2>
      <p>
        This deployment has no access to the old company’s database, documents or provider
        credentials. Zoho, Gmail, financial integrations, email delivery and customer signup are
        unavailable. An approval here changes only your local demo state. It never sends a message
        or authorizes a financial transaction.
      </p>
      <h2>Use fictional information</h2>
      <p>
        Please keep this demonstration fictional. Do not enter personal, confidential or sensitive
        information into local task or draft fields. This notice covers the public demo; a future
        customer workspace will require its own complete account and data-processing disclosures.
      </p>
    </InfoPage>
  );
}
