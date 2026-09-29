import { PageLoader } from "./_components/PageLoader";

/** Route-level loading UI shown while the dashboard's data is fetched. */
export default function DashboardLoading() {
  return <PageLoader label="Loading Executive Hub…" />;
}
