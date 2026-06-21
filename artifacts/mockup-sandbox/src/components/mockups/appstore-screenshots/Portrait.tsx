export function Portrait() {
  return (
    <div
      style={{
        width: 1260,
        height: 2736,
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
        color: "#fff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "radial-gradient(ellipse at 50% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, padding: "80px 60px 40px" }}>
        {/* Status Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40, padding: "0 10px" }}>
          <span style={{ fontSize: 32, fontWeight: 600 }}>9:41</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <svg width="36" height="24" viewBox="0 0 36 24" fill="white"><rect x="0" y="6" width="6" height="18" rx="2" opacity="0.3" /><rect x="10" y="4" width="6" height="20" rx="2" opacity="0.5" /><rect x="20" y="2" width="6" height="22" rx="2" opacity="0.7" /><rect x="30" y="0" width="6" height="24" rx="2" /></svg>
            <svg width="32" height="24" viewBox="0 0 32 24" fill="white"><path d="M16 8C20.4 8 24.4 9.8 27.2 12.6L29.6 10.2C26.2 6.8 21.4 4.8 16 4.8C10.6 4.8 5.8 6.8 2.4 10.2L4.8 12.6C7.6 9.8 11.6 8 16 8Z" opacity="0.5" /><path d="M16 14C18.8 14 21.2 15.2 23.2 17L25.6 14.6C23 12 19.6 10.4 16 10.4C12.4 10.4 9 12 6.4 14.6L8.8 17C10.8 15.2 13.2 14 16 14Z" opacity="0.7" /><circle cx="16" cy="21" r="3" /></svg>
            <div style={{ width: 56, height: 26, border: "2px solid rgba(255,255,255,0.5)", borderRadius: 8, position: "relative", display: "flex", alignItems: "center", padding: 3 }}>
              <div style={{ width: "75%", height: "100%", background: "#34d399", borderRadius: 4 }} />
              <div style={{ position: "absolute", right: -6, top: 7, width: 4, height: 10, background: "rgba(255,255,255,0.4)", borderRadius: "0 2px 2px 0" }} />
            </div>
          </div>
        </div>

        {/* Logo + Header */}
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <img src="/logo.png" alt="Tabula Medica" style={{ width: 120, height: 120, borderRadius: 28, marginBottom: 24, boxShadow: "0 8px 32px rgba(59,130,246,0.3)" }} />
          <h1 style={{ fontSize: 52, fontWeight: 700, margin: 0, letterSpacing: -1 }}>Tabula Medica</h1>
          <p style={{ fontSize: 26, color: "rgba(255,255,255,0.6)", margin: "8px 0 0", fontWeight: 400 }}>Your Health, Your Data, Your Control</p>
        </div>

        {/* Welcome Card */}
        <div style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderRadius: 28,
          padding: "36px 40px",
          marginBottom: 32,
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}>
          <h2 style={{ fontSize: 36, fontWeight: 600, margin: "0 0 8px" }}>Welcome back, Sarah</h2>
          <p style={{ fontSize: 22, color: "rgba(255,255,255,0.5)", margin: 0 }}>Manage your health records in one secure place</p>
        </div>

        {/* Quick Action Cards */}
        <div style={{ display: "flex", gap: 20, marginBottom: 32 }}>
          {[
            { icon: "🩺", title: "Health History", sub: "Update records", color: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)" },
            { icon: "🔗", title: "Connect EHR", sub: "Import data", color: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)" },
            { icon: "📋", title: "My Records", sub: "View all", color: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.3)" },
          ].map((card) => (
            <div
              key={card.title}
              style={{
                flex: 1,
                background: card.color,
                borderRadius: 24,
                padding: "32px 24px",
                border: `1px solid ${card.border}`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>{card.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{card.title}</div>
              <div style={{ fontSize: 17, color: "rgba(255,255,255,0.5)" }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Account Status */}
        <div style={{
          background: "rgba(255,255,255,0.06)",
          borderRadius: 24,
          padding: "28px 36px",
          marginBottom: 32,
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1 }}>Account Status</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {[
              { label: "EHR Sources", value: "3", color: "#3b82f6" },
              { label: "Last Sync", value: "Today", color: "#10b981" },
              { label: "Records", value: "247", color: "#8b5cf6" },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 42, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Features Row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          {[
            { icon: "🤖", label: "AI Health Advisor", badge: "PRO" },
            { icon: "📊", label: "Smart Summary", badge: "PRO" },
          ].map((feat) => (
            <div
              key={feat.label}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 20,
                padding: "24px 20px",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span style={{ fontSize: 36 }}>{feat.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{feat.label}</div>
              </div>
              <span style={{
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: 8,
                letterSpacing: 1,
              }}>{feat.badge}</span>
            </div>
          ))}
        </div>

        {/* In-App Purchase / Paywall Button */}
        <div style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(168,85,247,0.2))",
          borderRadius: 28,
          padding: "36px 40px",
          marginBottom: 32,
          border: "1px solid rgba(99,102,241,0.3)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Unlock Full Access</div>
          <h3 style={{ fontSize: 34, fontWeight: 700, margin: "0 0 8px" }}>Tabula Medica Pro</h3>
          <p style={{ fontSize: 20, color: "rgba(255,255,255,0.5)", margin: "0 0 28px" }}>AI-powered insights, unlimited EHR connections, and priority support</p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 24 }}>
            {[
              { period: "Monthly", price: "$9.99", sub: "/month" },
              { period: "Annual", price: "$79.99", sub: "/year", best: true },
            ].map((plan) => (
              <div
                key={plan.period}
                style={{
                  background: plan.best ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "rgba(255,255,255,0.08)",
                  borderRadius: 20,
                  padding: "20px 32px",
                  border: plan.best ? "2px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.1)",
                  minWidth: 180,
                  position: "relative" as const,
                }}
              >
                {plan.best && (
                  <div style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#f59e0b",
                    color: "#000",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 14px",
                    borderRadius: 10,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}>Best Value</div>
                )}
                <div style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>{plan.period}</div>
                <div style={{ fontSize: 32, fontWeight: 700 }}>{plan.price}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>{plan.sub}</div>
              </div>
            ))}
          </div>
          <button style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            color: "#fff",
            fontSize: 24,
            fontWeight: 700,
            padding: "20px 80px",
            borderRadius: 16,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(59,130,246,0.4)",
            letterSpacing: 0.5,
          }}>
            Subscribe Now
          </button>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", margin: "16px 0 0" }}>7-day free trial · Cancel anytime</p>
        </div>

        {/* Bottom Safety Badge */}
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.1)", padding: "10px 24px", borderRadius: 12, border: "1px solid rgba(16,185,129,0.2)" }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <span style={{ fontSize: 16, color: "#34d399", fontWeight: 500 }}>HIPAA Compliant · Zero-Knowledge Encryption</span>
          </div>
        </div>

        {/* Home Indicator */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
          <div style={{ width: 200, height: 6, background: "rgba(255,255,255,0.3)", borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}
