import "../globals.css";

export const metadata = {
  title: "Quote Builder — AutoGate Electric",
  description:
    "Select products and submit your quote request to AutoGate Electric.",
};

export default function QuoteBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        style={{
          background: "#0B0F19",
          color: "#F3F4F6",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
