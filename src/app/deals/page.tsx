import { getOrCreateTenant } from "../../lib/tenant";
import { listDeals } from "../../lib/tools";
import { DealsBoard, type DealRow } from "./DealsBoard";

/**
 * /deals — the sales pipeline kanban. Deals are opened automatically from
 * sales-inquiry / quote-request emails (linked to the sender's contact) and
 * moved through New → Quoted → Won/Lost here.
 */
export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const deals = await listDeals();

  const rows: DealRow[] = deals.map((d) => ({
    id: d.id,
    title: d.title,
    stage: d.stage,
    value: d.value,
    contactId: d.contact?.id ?? null,
    contactName: d.contact?.name ?? null,
    contactEmail: d.contact?.email ?? null,
    sourceSubject: d.sourceSubject,
    updatedAtLabel: d.updatedAt.toLocaleDateString(),
  }));

  return <DealsBoard initial={rows} />;
}
