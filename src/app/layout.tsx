import "./globals.css";
import { Suspense } from "react";
import { AuthProvider } from "./_components/AuthProvider";
import { ToastProvider } from "./_components/Toast";
import { ConfirmProvider } from "./_components/ConfirmDialog";
import { AppHeader } from "./_components/AppHeader";
import { NavigationProgressProvider } from "./_components/NavigationProgress";
import { APP_HEADER_HEIGHT } from "./_components/app-nav";
import { AssistantLauncher } from "./_components/AssistantLauncher";

export const metadata = {
  title: "Mailbox",
  description: "AI email assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <Suspense fallback={null}>
                <NavigationProgressProvider>
                  <AppHeader />
                  {/* Push normal in-flow pages below the fixed header. Full-screen
                      overlay pages (mailbox, planner, contacts) offset themselves. */}
                  <div style={{ paddingTop: APP_HEADER_HEIGHT }}>{children}</div>
                  <AssistantLauncher />
                </NavigationProgressProvider>
              </Suspense>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
