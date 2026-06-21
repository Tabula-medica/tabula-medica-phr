export function Landscape() {
  return (
    <div
      style={{
        width: 2736,
        height: 1260,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
        color: "#fff",
        overflow: "hidden",
        position: "relative",
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "radial-gradient(ellipse at 30% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 40%, rgba(168, 85, 247, 0.08) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      {/* Left Panel — Sidebar + Brand */}
      <div style={{
        width: 520,
        position: "relative",
        zIndex: 1,
        padding: "60px 40px",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.15)",
      }}>
        {/* Status Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <span style={{ fontSize: 24, fontWeight: 600 }}>9:41</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <svg width="28" height="18" viewBox="0 0 36 24" fill="white"><rect x="0" y="6" width="6" height="18" rx="2" opacity="0.3" /><rect x="10" y="4" width="6" height="20" rx="2" opacity="0.5" /><rect x="20" y="2" width="6" height="22" rx="2" opacity="0.7" /><rect x="30" y="0" width="6" height="24" rx="2" /></svg>
            <div style={{ width: 44, height: 20, border: "2px solid rgba(255,255,255,0.5)", borderRadius: 6, position: "relative", display: "flex", alignItems: "center", padding: 2 }}>
              <div style={{ width: "75%", height: "100%", background: "#34d399", borderRadius: 3 }} />
            </div>
          </div>
        </div>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src="/logo.png" alt="Tabula Medica" style={{ width: 100, height: 100, borderRadius: 24, marginBottom: 16, boxShadow: "0 8px 24px rgba(59,130,246,0.3)" }} />
          <h1 style={{ fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Tabula Medica</h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", margin: "6px 0 0" }}>Your Health, Your Data</p>
        </div>

        {/* Sidebar Nav */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { icon: "🏠", label: "Home", active: true },
            { icon: "❤️", label: "Health Summary" },
            { icon: "📋", label: "My Records" },
            { icon: "⏱", label: "Timeline" },
            { icon: "🤖", label: "AI Advisor", badge: "PRO" },
            { icon: "💬", label: "Messages" },
            { icon: "📹", label: "Telehealth" },
            { icon: "⚙️", label: "Settings" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                borderRadius: 14,
                background: item.active ? "rgba(59,130,246,0.15)" : "transparent",
                border: item.active ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                fontSize: 20,
              }}
            >
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <span style={{ fontWeight: item.active ? 600 : 400, color: item.active ? "#fff" : "rgba(255,255,255,0.6)" }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  marginLeft: "auto",
                  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 6,
                  letterSpacing: 1,
                }}>{item.badge}</span>
              )}
            </div>
          ))}
        </div>

        {/* HIPAA Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <span style={{ fontSize: 13, color: "#34d399", fontWeight: 500 }}>HIPAA · FIPS 140-3</span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, position: "relative", zIndex: 1, padding: "60px 50px", overflow: "hidden" }}>
        {/* Welcome */}
        <div style={{
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(40px)",
          borderRadius: 24,
          padding: "28px 36px",
          marginBottom: 28,
          border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <h2 style={{ fontSize: 32, fontWeight: 600, margin: 0 }}>Welcome back, Sarah</h2>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", margin: "6px 0 0" }}>Manage your health records in one secure place</p>
        </div>

        {/* Top Row: Quick Actions + Account Status */}
        <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
          {/* Quick Actions */}
          <div style={{ display: "flex", gap: 16, flex: 1 }}>
            {[
              { icon: "🩺", title: "Health History", sub: "Update records", color: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)" },
              { icon: "🔗", title: "Connect EHR", sub: "Import data", color: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)" },
              { icon: "📋", title: "My Records", sub: "View all", color: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.25)" },
            ].map((card) => (
              <div key={card.title} style={{ flex: 1, background: card.color, borderRadius: 20, padding: "24px 20px", border: `1px solid ${card.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{card.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>{card.title}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Account Status */}
          <div style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 20,
            padding: "24px 32px",
            border: "1px solid rgba(255,255,255,0.08)",
            minWidth: 340,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Account Status</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
              {[
                { label: "EHR Sources", value: "3", color: "#3b82f6" },
                { label: "Last Sync", value: "Today", color: "#10b981" },
                { label: "Records", value: "247", color: "#8b5cf6" },
              ].map((stat) => (
                <div key={stat.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* In-App Purchase / Paywall Button */}
        <div style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(168,85,247,0.15))",
          borderRadius: 24,
          padding: "32px 40px",
          border: "1px solid rgba(99,102,241,0.25)",
          display: "flex",
          alignItems: "center",
          gap: 40,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Unlock Full Access</div>
            <h3 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 6px" }}>Tabula Medica Pro</h3>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.5)", margin: 0 }}>AI-powered insights, unlimited EHR connections, and priority support</p>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {[
              { period: "Monthly", price: "$9.99", sub: "/mo" },
              { period: "Annual", price: "$79.99", sub: "/yr", best: true },
            ].map((plan) => (
              <div
                key={plan.period}
                style={{
                  background: plan.best ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "16px 24px",
                  border: plan.best ? "2px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  minWidth: 140,
                  textAlign: "center",
                  position: "relative" as const,
                }}
              >
                {plan.best && (
                  <div style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#f59e0b",
                    color: "#000",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: 8,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}>Best Value</div>
                )}
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{plan.period}</div>
                <div style={{ fontSize: 26, fontWeight: 700 }}>{plan.price}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{plan.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <button style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: "#fff",
              fontSize: 20,
              fontWeight: 700,
              padding: "16px 48px",
              borderRadius: 14,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 6px 24px rgba(59,130,246,0.35)",
              whiteSpace: "nowrap",
            }}>
              Subscribe Now
            </button>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>7-day free trial · Cancel anytime</p>
          </div>
        </div>

        {/* Home Indicator */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
          <div style={{ width: 180, height: 5, background: "rgba(255,255,255,0.25)", borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}
