import { redirect } from "next/navigation";

/**
 * /team — legacy route; team workload now lives in Planner (Team view).
 */
export default function TeamPage() {
  redirect("/planner?view=team");
}
