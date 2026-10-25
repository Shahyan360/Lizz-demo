import { InfoPage } from '@/components/info-page';
export const metadata = { title: 'Demo terms' };
export default function Terms() {
  return (
    <InfoPage title="A place to explore." eyebrow="PUBLIC DEMO TERMS">
      <p>
        Lizz is provided here for product evaluation using fictional data. It is a demonstration,
        and it is not available for operating a real business or connecting customer accounts in
        this release.
      </p>
      <h2>Use the demo fairly</h2>
      <p>
        Explore the features through the interface. Do not attempt to extract secrets, bypass usage
        limits, attack the service or submit confidential information. AI allowances are shared and
        may change; sample responses remain available when live AI cannot run.
      </p>
      <h2>Review AI output</h2>
      <p>
        AI can make mistakes. All prices, orders and estimates in this demo are fictional. Suggested
        drafts, classifications and tasks require human review. They do not create an offer,
        contract, financial obligation or external action.
      </p>
      <h2>Temporary, local state</h2>
      <p>
        Demo work can be reset, expire or become unavailable. Do not rely on this service to store
        work. No paid plan, billing service, enterprise certification, production service-level
        commitment or customer support commitment is offered by this demonstration.
      </p>
      <h2>Customer release</h2>
      <p>
        Real workspaces, customer authentication and organization-owned integrations require a
        separate release and review. These notes describe the current demo and are not a substitute
        for the full legal terms a commercial service will need.
      </p>
    </InfoPage>
  );
}
