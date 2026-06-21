import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Heart, ArrowRight, Link2, Lock,
  Search, Building2, MapPin, Loader2,
  Activity, Brain, Languages, CheckCircle2,
  Network, Sparkles, GitMerge, QrCode,
  Stethoscope, Globe, Mail, ChevronRight,
  Zap, Eye, FileText, Users
} from "lucide-react";

const C = {
  sapphire: "#2563eb",
  sapphireDark: "#1e40af",
  teal: "#0d9488",
  tealLight: "#14b8a6",
  emerald: "#059669",
  amber: "#d97706",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  slate950: "#020617",
};

const trustBadges = [
  { label: "HIPAA", sub: "Compliant", color: C.sapphire },
  { label: "SOC 2", sub: "Type II", color: C.emerald },
  { label: "FHIR R4", sub: "Certified", color: C.teal },
  { label: "TEFCA", sub: "Connected", color: C.amber },
];

const steps = [
  {
    num: "01",
    icon: Network,
    title: "Connect Your Records",
    desc: "Link to 70,000+ healthcare sites through the national TEFCA network. Your data flows directly to you—no middleman.",
    accent: C.sapphire,
  },
  {
    num: "02",
    icon: Sparkles,
    title: "AI Summarization",
    desc: "Med-Gemini 1.5 Pro transforms hundreds of pages of clinical notes into a concise, chronological care summary.",
    accent: C.teal,
  },
  {
    num: "03",
    icon: GitMerge,
    title: "Smart Deduplication",
    desc: "Automatic detection and merge of duplicate labs, imaging, and records for a noise-free clinical timeline.",
    accent: C.emerald,
  },
  {
    num: "04",
    icon: QrCode,
    title: "Share Instantly",
    desc: "Share your summarized record with any provider via a secure link or QR code—avoid duplicate testing.",
    accent: C.amber,
  },
];

const features = [
  { icon: Link2, title: "Direct Hospital Connection", desc: "Connect via SMART on FHIR. No middleman—your data flows straight to you." },
  { icon: Shield, title: "HIPAA & SOC 2 Compliant", desc: "Enterprise-grade encryption with strict access controls and full audit logging." },
  { icon: Activity, title: "Unified Health Records", desc: "Labs, meds, conditions, and immunizations—all in one secure, easy-to-read place." },
  { icon: Brain, title: "AI Health Insights", desc: "Plain-language explanations of your data, powered by Med-Gemini with clinical audit trails." },
  { icon: Languages, title: "19 Languages", desc: "Medical terminology translated into your preferred language for better health literacy." },
  { icon: Lock, title: "You Own Your Data", desc: "Share on your terms. Revoke access anytime. Zero-knowledge encryption." },
];

const hospitals = [
  { name: "Inova Health System", region: "Northern Virginia" },
  { name: "UVA Health System", region: "Charlottesville, VA" },
  { name: "Sentara Healthcare", region: "Hampton Roads, VA" },
  { name: "Healow (eClinicalWorks)", region: "Nationwide" },
];

export function RefreshedLanding() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: C.slate800, background: "#fff" }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 32px",
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: `1px solid ${C.slate200}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.sapphire}, ${C.teal})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Stethoscope size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: C.slate900, letterSpacing: "-0.02em" }}>
            Tabula Medica
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a href="#" style={{ fontSize: 14, color: C.slate700, textDecoration: "none" }}>How It Works</a>
          <a href="#" style={{ fontSize: 14, color: C.slate700, textDecoration: "none" }}>Features</a>
          <a href="#" style={{ fontSize: 14, color: C.slate700, textDecoration: "none" }}>Privacy</a>
          <Button size="sm" style={{
            background: C.sapphire, borderRadius: 8, fontWeight: 600, fontSize: 13,
            padding: "8px 20px",
          }}>
            Log In
          </Button>
        </div>
      </nav>

      <section style={{
        position: "relative", overflow: "hidden",
        background: `linear-gradient(145deg, ${C.slate950} 0%, #0c1a3a 40%, #0a2540 70%, #072e3a 100%)`,
        padding: "80px 32px 96px",
      }}>
        <div style={{
          position: "absolute", top: -120, right: -120,
          width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)`,
        }} />
        <div style={{
          position: "absolute", bottom: -80, left: "30%",
          width: 400, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)`,
        }} />

        <div style={{ maxWidth: 720, position: "relative", zIndex: 2 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 999,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
            fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500,
            marginBottom: 28,
          }}>
            <Heart size={14} color="#34d399" fill="#34d399" />
            Free forever for patients
          </div>

          <h1 style={{
            fontSize: 56, fontWeight: 800, lineHeight: 1.08,
            color: "#fff", letterSpacing: "-0.03em",
            margin: "0 0 24px",
          }}>
            Your Health Records,{" "}
            <span style={{
              background: `linear-gradient(135deg, #5eead4, #38bdf8, #818cf8)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Unified & Clear.
            </span>
          </h1>

          <p style={{
            fontSize: 19, lineHeight: 1.6, color: "rgba(191,219,254,0.65)",
            maxWidth: 580, margin: "0 0 36px",
          }}>
            Connect to 70,000+ healthcare sites. Get AI-powered summaries of your clinical history.
            Share securely with any provider. All in one HIPAA-compliant platform.
          </p>

          <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
            <Button size="lg" style={{
              height: 52, padding: "0 32px", fontSize: 16, fontWeight: 600, borderRadius: 12,
              background: `linear-gradient(135deg, ${C.sapphire}, #3b82f6)`,
              boxShadow: `0 8px 24px rgba(37,99,235,0.35)`,
            }}>
              Get Started Free <ArrowRight size={18} style={{ marginLeft: 8 }} />
            </Button>
            <Button size="lg" variant="outline" style={{
              height: 52, padding: "0 28px", fontSize: 16, fontWeight: 500, borderRadius: 12,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
            }}>
              <Search size={16} style={{ marginRight: 8 }} />
              Find Your Hospital
            </Button>
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            {["No credit card", "HIPAA compliant", "Available worldwide"].map(t => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(148,163,184,0.7)" }}>
                <CheckCircle2 size={14} color="rgba(52,211,153,0.6)" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div style={{
        background: C.slate50, borderBottom: `1px solid ${C.slate200}`,
        padding: "16px 32px",
      }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 48 }}>
          {trustBadges.map(b => (
            <div key={b.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: b.color, letterSpacing: "0.02em" }}>{b.label}</div>
              <div style={{ fontSize: 11, color: C.slate700, marginTop: 2 }}>{b.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <section style={{ padding: "80px 32px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 999,
            background: `${C.sapphire}0d`, fontSize: 12, fontWeight: 600,
            color: C.sapphire, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 16,
          }}>
            <Zap size={12} />
            How It Works
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 700, color: C.slate900, letterSpacing: "-0.02em", margin: 0 }}>
            Four Steps to Your Palm Record
          </h2>
          <p style={{ fontSize: 16, color: C.slate700, marginTop: 12, maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>
            From connection to sharing — your complete health journey, simplified.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {steps.map((s, i) => (
            <div key={s.title} style={{
              padding: 28, borderRadius: 16,
              border: `1px solid ${C.slate200}`,
              background: "#fff",
              display: "flex", gap: 16, alignItems: "flex-start",
              transition: "all 0.2s",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: `${s.accent}10`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <s.icon size={22} color={s.accent} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.accent, letterSpacing: "0.08em", marginBottom: 6 }}>
                  STEP {s.num}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: C.slate900, margin: "0 0 8px" }}>{s.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: C.slate700, margin: 0 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{
        padding: "80px 32px",
        background: `linear-gradient(180deg, ${C.slate50} 0%, #fff 100%)`,
        borderTop: `1px solid ${C.slate200}`,
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 700, color: C.slate900, letterSpacing: "-0.02em", margin: 0 }}>
              Connect to Your Hospital
            </h2>
            <p style={{ fontSize: 16, color: C.slate700, marginTop: 12 }}>
              Search 25,000+ Epic-connected hospitals and health systems
            </p>
          </div>

          <div style={{ maxWidth: 560, margin: "0 auto 40px" }}>
            <div style={{ position: "relative" }}>
              <Search size={18} color={C.slate700} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
              <Input
                placeholder="Search hospitals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: 52, paddingLeft: 48, fontSize: 15, borderRadius: 14,
                  border: `2px solid ${C.slate200}`, background: "#fff",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {hospitals.map(h => (
              <div key={h.name} style={{
                padding: 20, borderRadius: 14,
                border: `1px solid ${C.slate200}`, background: "#fff",
                cursor: "pointer",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${C.sapphire}0d`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 12,
                }}>
                  <Building2 size={20} color={C.sapphire} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.slate900 }}>{h.name}</div>
                <div style={{ fontSize: 12, color: C.slate700, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={12} /> {h.region}
                </div>
                <div style={{
                  marginTop: 12, fontSize: 12, fontWeight: 600, color: C.sapphire,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  Connect <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 32px", borderTop: `1px solid ${C.slate200}` }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 700, color: C.slate900, letterSpacing: "-0.02em", margin: 0 }}>
              Everything You Need
            </h2>
            <p style={{ fontSize: 16, color: C.slate700, marginTop: 12 }}>
              One secure platform to access, understand, and share your complete medical history.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {features.map(f => (
              <div key={f.title} style={{
                padding: 28, borderRadius: 16,
                border: `1px solid ${C.slate200}`, background: "#fff",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `linear-gradient(135deg, ${C.sapphire}0d, ${C.teal}0d)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16,
                }}>
                  <f.icon size={20} color={C.sapphire} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.slate900, margin: "0 0 8px" }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: C.slate700, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{
        padding: "64px 32px",
        background: `linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #f0fdfa 100%)`,
        borderTop: `1px solid ${C.slate200}`,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              display: "inline-flex", padding: "5px 12px", borderRadius: 999,
              background: "rgba(217,119,6,0.15)", fontSize: 12, fontWeight: 700,
              color: C.amber, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 16,
            }}>
              Uninsurance Mode
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 700, color: C.slate900, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
              No Insurance? <span style={{ color: C.amber, fontStyle: "italic" }}>No Problem.</span>
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.slate700, margin: "0 0 20px" }}>
              Find affordable care at FQHC community health centers, compare transparent cash-pay rates,
              and track savings — all without an insurance card.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "HRSA clinic finder with sliding-scale pricing",
                "Cash-pay rate comparison (save 40–70%)",
                "VA CCN referral pathway at $0 cost",
                "AI health assistant in 6 languages",
              ].map(item => (
                <li key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: C.slate700 }}>
                  <CheckCircle2 size={16} color={C.amber} />
                  {item}
                </li>
              ))}
            </ul>
            <Button style={{
              background: C.amber, borderRadius: 10, fontWeight: 600,
              padding: "10px 24px",
              boxShadow: `0 4px 12px rgba(217,119,6,0.25)`,
            }}>
              Learn More <ArrowRight size={16} style={{ marginLeft: 8 }} />
            </Button>
          </div>
          <div style={{
            width: 200, height: 200, borderRadius: 24, flexShrink: 0,
            background: `linear-gradient(135deg, rgba(217,119,6,0.12), rgba(13,148,136,0.12))`,
            border: "1px solid rgba(217,119,6,0.2)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8,
          }}>
            <Users size={40} color={C.amber} />
            <div style={{ fontSize: 28, fontWeight: 800, color: C.slate900 }}>28M+</div>
            <div style={{ fontSize: 12, color: C.slate700, textAlign: "center" }}>Uninsured Americans<br />deserve affordable care</div>
          </div>
        </div>
      </section>

      <section style={{
        padding: "80px 32px",
        background: `linear-gradient(180deg, #fff 0%, ${C.slate50} 100%)`,
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, color: C.slate900, letterSpacing: "-0.03em", margin: "0 0 16px" }}>
            Take Control of Your Health Data
          </h2>
          <p style={{ fontSize: 17, color: C.slate700, margin: "0 0 32px", lineHeight: 1.6 }}>
            Join patients worldwide who use Tabula Medica to own and understand their health records. Free, forever.
          </p>
          <Button size="lg" style={{
            height: 52, padding: "0 36px", fontSize: 16, fontWeight: 600, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.sapphire}, #3b82f6)`,
            boxShadow: `0 8px 24px rgba(37,99,235,0.3)`,
          }}>
            Get Started Free <ArrowRight size={18} style={{ marginLeft: 8 }} />
          </Button>
        </div>
      </section>

      <footer style={{
        padding: "24px 32px", borderTop: `1px solid ${C.slate200}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 13, color: C.slate700,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Stethoscope size={14} color={C.slate700} />
          &copy; 2026 Tabula Medica
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="#" style={{ color: C.slate700, textDecoration: "none" }}>Privacy</a>
          <a href="#" style={{ color: C.slate700, textDecoration: "none" }}>Terms</a>
          <a href="#" style={{ color: C.slate700, textDecoration: "none" }}>Security</a>
          <a href="#" style={{ color: C.slate700, textDecoration: "none" }}>Contact</a>
        </div>
      </footer>
    </div>
  );
}
