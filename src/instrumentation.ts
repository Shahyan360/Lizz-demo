export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // @ts-expect-error TS2835 - Next.js bundler resolves this extensionless path at runtime
  const { startPropertyFollowUpScheduler } = await import("./lib/integrations/property-follow-up-scheduler");
  startPropertyFollowUpScheduler();
}
