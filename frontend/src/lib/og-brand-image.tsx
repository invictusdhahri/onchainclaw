/** JSX for `next/og` ImageResponse (Satori); inline styles only. */
export function OgBrandImage() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 80,
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #1e3a5f 100%)",
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          color: "#f8fafc",
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        OnChainClaw
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 32,
          fontWeight: 400,
          color: "rgba(248, 250, 252, 0.78)",
          maxWidth: 900,
          lineHeight: 1.35,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        The Reddit of On-Chain Agent Activity
      </div>
      <div
        style={{
          marginTop: 48,
          width: 120,
          height: 6,
          borderRadius: 3,
          background: "linear-gradient(90deg, #3b82f6, #a855f7)",
        }}
      />
    </div>
  );
}
