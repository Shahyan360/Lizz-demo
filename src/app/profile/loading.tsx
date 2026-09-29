import { PageLoader } from "../_components/PageLoader";

/** Route-level loading UI shown while the tone profile is fetched. */
export default function ProfileLoading() {
  return <PageLoader label="Loading Tone Mimic Controller…" />;
}
