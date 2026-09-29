import { requireUser } from "../../../lib/auth/session";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  await requireUser();
  return <ChangePasswordForm />;
}
