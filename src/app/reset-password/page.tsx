import { ResetPasswordForm } from "./ResetPasswordForm";
import { isResetTokenValid } from "../forgot-password/actions";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token?.trim() ?? "";
  const tokenValid = token ? await isResetTokenValid(token) : false;
  return <ResetPasswordForm token={token} tokenValid={tokenValid} />;
}
