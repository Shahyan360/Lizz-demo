/** Light full-screen loader shown while the mailbox's data is fetched. */
export default function ZohoLoading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.7rem",
        color: "#5c6672",
      }}
    >
      <span
        className="spinner"
        style={{ width: "1.4rem", height: "1.4rem", color: "#2563eb" }}
      />
      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
        Loading mailbox…
      </span>
    </div>
  );
}
