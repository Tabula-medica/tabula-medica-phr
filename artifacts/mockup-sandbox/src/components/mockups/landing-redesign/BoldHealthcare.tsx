import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Heart, ArrowRight, Link2, Lock,
  Search, Building2, MapPin, CheckCircle2,
  Network, Sparkles, GitMerge, QrCode,
  Activity, Brain, Languages, Stethoscope,
  Globe, Mail, ChevronRight, Users, Zap,
  Star, Clock, FileHeart
} from "lucide-react";

const C = {
  indigo: "#4f46e5",
  indigoDark: "#3730a3",
  indigoLight: "#6366f1",
  cyan: "#06b6d4",
  cyanDark: "#0891b2",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  white: "#ffffff",
  gray50: "#fafafa",
  gray100: "#f5f5f5",
  gray200: "#e5e5e5",
  gray500: "#737373",
  gray700: "#404040",
  gray800: "#262626",
  gray900: "#171717",
  gray950: "#0a0a0a",
};

const stats = [
  { value: "70K+", label: "Healthcare Sites", color: C.indigo },
  { value: "25K+", label: "Hospitals", color: C.cyan },
  { value: "19", label: "Languages", color: C.emerald },
  { value: "100%", label: "Free Forever", color: C.amber },
];

const steps = [
  {
    icon: Network, title: "National Reach",
    desc: "Pull records from 70,000+ sites via the TEFCA network and SMART on FHIR.",
    gradient: `linear-gradient(135deg, ${C.indigo}, ${C.indigoLight})`,
  },
  {
    icon: Sparkles, title: "AI Summarization",
    desc: "Med-Gemini 1.5 Pro transforms clinical notes into clear, chronological summaries.",
    gradient: `linear-gradient(135deg, ${C.cyan}, ${C.emerald})`,
  },
  {
    icon: GitMerge, title: "Smart Dedup",
    desc: "Automatic merge of duplicate labs and imaging for a noise-free timeline.",
    gradient: `linear-gradient(135deg, ${C.emerald}, #34d399)`,
  },
  {
    icon: QrCode, title: "Instant Sharing",
    desc: "Share with any provider via secure link or QR code. Avoid duplicate testing.",
    gradient: `linear-gradient(135deg, ${C.amber}, #fbbf24)`,
  },
];

const features = [
  { icon: Link2, title: "Direct Connection", desc: "SMART on FHIR — no middleman.", color: C.indigo },
  { icon: Shield, title: "Enterprise Security", desc: "HIPAA + SOC 2 Type II compliant.", color: C.emerald },
  { icon: Activity, title: "Unified Records", desc: "Labs, meds, conditions — one place.", color: C.cyan },
  { icon: Brain, title: "AI Insights", desc: "Plain-language health explanations.", color: C.indigoLight },
  { icon: Languages, title: "19 Languages", desc: "Medical terms in your language.", color: C.amber },
  { icon: Lock, title: "Data Ownership", desc: "Zero-knowledge encryption. You control it.", color: C.rose },
];

const hospitals = [
  { name: "Inova Health", region: "Northern VA" },
  { name: "UVA Health", region: "Charlottesville" },
  { name: "Sentara", region: "Hampton Roads" },
  { name: "Healow", region: "Nationwide" },
];

export function BoldHealthcare() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: C.gray800, background: C.white }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 32px",
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${C.gray200}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.indigo}, ${C.cyan})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileHeart size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: C.gray900, letterSpacing: "-0.03em" }}>
            Tabula Medica
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a href="#" style={{ fontSize: 14, color: C.gray700, textDecoration: "none", fontWeight: 500 }}>How It Works</a>
          <a href="#" style={{ fontSize: 14, color: C.gray700, textDecoration: "none", fontWeight: 500 }}>Features</a>
          <a href="#" style={{ fontSize: 14, color: C.gray700, textDecoration: "none", fontWeight: 500 }}>Privacy</a>
          <Button size="sm" style={{
            background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoLight})`,
            borderRadius: 10, fontWeight: 600, fontSize: 13, padding: "8px 22px",
          }}>
            Log In <ArrowRight size={14} style={{ marginLeft: 6 }} />
          </Button>
        </div>
      </nav>

      <section style={{
        position: "relative", overflow: "hidden",
        background: C.gray950,
        padding: "88px 32px 72px",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(79,70,229,0.2) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 30%, rgba(6,182,212,0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 90%, rgba(16,185,129,0.1) 0%, transparent 50%)
          `,
        }} />

        <div style={{ maxWidth: 1000, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div style={{ maxWidth: 640, marginBottom: 56 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 999,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 500,
              marginBottom: 24,
            }}>
              <Heart size={13} color="#34d399" fill="#34d399" />
              Free forever for patients
            </div>

            <h1 style={{
              fontSize: 52, fontWeight: 900, lineHeight: 1.06,
              color: "#fff", letterSpacing: "-0.04em",
              margin: "0 0 20px",
            }}>
              One Record.{" "}
              <br />
              <span style={{
                background: `linear-gradient(135deg, ${C.cyan}, ${C.emerald}, ${C.amber})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Every Provider.
              </span>
            </h1>

            <p style={{
              fontSize: 18, lineHeight: 1.65, color: "rgba(212,212,216,0.65)",
              maxWidth: 520, margin: "0 0 32px",
            }}>
              Tabula Medica unifies your fragmented medical data into a single,
              AI-summarized health record you can share with any provider instantly.
            </p>

            <div style={{ display: "flex", gap: 12 }}>
              <Button size="lg" style={{
                height: 50, padding: "0 30px", fontSize: 15, fontWeight: 700, borderRadius: 12,
                background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoLight})`,
                boxShadow: `0 0 40px rgba(79,70,229,0.4)`,
              }}>
                Get Started Free <ArrowRight size={16} style={{ marginLeft: 8 }} />
              </Button>
              <Button size="lg" variant="outline" style={{
                height: 50, padding: "0 24px", fontSize: 15, fontWeight: 600, borderRadius: 12,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
              }}>
                Learn More
              </Button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {stats.map(s => (
              <div key={s.label} style={{
                padding: "20px 24px", borderRadius: 14,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)",
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "rgba(212,212,216,0.5)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 32px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: C.gray900, letterSpacing: "-0.03em", margin: "0 0 10px" }}>
            How It Works
          </h2>
          <p style={{ fontSize: 15, color: C.gray500, margin: 0 }}>
            Connect, summarize, deduplicate, and share — in four simple steps.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {steps.map((s, i) => (
            <div key={s.title} style={{
              padding: 24, borderRadius: 16,
              border: `1px solid ${C.gray200}`, background: C.white,
              textAlign: "center",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: s.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: `0 4px 12px rgba(0,0,0,0.1)`,
              }}>
                <s.icon size={24} color="#fff" />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.gray500, letterSpacing: "0.1em", marginBottom: 8 }}>
                STEP {i + 1}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.gray900, margin: "0 0 8px" }}>{s.title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: C.gray500, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{
        padding: "64px 32px",
        background: C.gray50, borderTop: `1px solid ${C.gray200}`, borderBottom: `1px solid ${C.gray200}`,
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: C.gray900, letterSpacing: "-0.03em", margin: "0 0 10px" }}>
              Find Your Hospital
            </h2>
            <p style={{ fontSize: 15, color: C.gray500, margin: 0 }}>
              25,000+ Epic-connected hospitals ready to connect
            </p>
          </div>

          <div style={{ maxWidth: 520, margin: "0 auto 32px" }}>
            <div style={{ position: "relative" }}>
              <Search size={18} color={C.gray500} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
              <Input
                placeholder="Search hospitals and health systems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: 50, paddingLeft: 48, fontSize: 15, borderRadius: 14,
                  border: `2px solid ${C.gray200}`, background: C.white,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {hospitals.map(h => (
              <button key={h.name} style={{
                padding: 18, borderRadius: 14,
                border: `1px solid ${C.gray200}`, background: C.white,
                cursor: "pointer", textAlign: "left",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${C.indigo}10`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Building2 size={18} color={C.indigo} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.gray900 }}>{h.name}</div>
                  <div style={{ fontSize: 12, color: C.gray500, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={11} /> {h.region}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.indigo, display: "flex", alignItems: "center", gap: 3 }}>
                  Connect via MyChart <ChevronRight size={13} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: C.gray900, letterSpacing: "-0.03em", margin: "0 0 10px" }}>
              Built for Patients
            </h2>
            <p style={{ fontSize: 15, color: C.gray500, margin: 0 }}>
              Every feature designed around your needs — security, clarity, and control.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {features.map(f => (
              <div key={f.title} style={{
                padding: 24, borderRadius: 16,
                border: `1px solid ${C.gray200}`, background: C.white,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${f.color}12`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 14,
                }}>
                  <f.icon size={20} color={f.color} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: C.gray900, margin: "0 0 6px" }}>{f.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: C.gray500, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{
        padding: "56px 32px",
        background: `linear-gradient(135deg, #fefce8 0%, #fef9c3 40%, #ecfdf5 100%)`,
        borderTop: `1px solid ${C.gray200}`,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              display: "inline-flex", padding: "5px 12px", borderRadius: 999,
              background: `${C.amber}20`, fontSize: 12, fontWeight: 700,
              color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 14,
            }}>
              Uninsurance Mode
            </div>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: C.gray900, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
              No Insurance? <span style={{ color: "#b45309" }}>No Problem.</span>
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: C.gray700, margin: "0 0 16px" }}>
              FQHC clinic finder, cash-pay rate comparison, VA CCN pathway, and savings tracking.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {["Sliding-scale pricing", "Save 40–70%", "$0 VA pathway", "6 languages"].map(t => (
                <span key={t} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 8,
                  background: "rgba(217,119,6,0.1)", fontSize: 12, fontWeight: 600, color: "#92400e",
                }}>
                  <CheckCircle2 size={12} /> {t}
                </span>
              ))}
            </div>
            <Button style={{
              background: `linear-gradient(135deg, #d97706, #f59e0b)`,
              borderRadius: 10, fontWeight: 600, padding: "10px 22px",
              boxShadow: `0 4px 12px rgba(217,119,6,0.25)`,
            }}>
              Explore Uninsurance Mode <ArrowRight size={14} style={{ marginLeft: 8 }} />
            </Button>
          </div>
          <div style={{
            width: 180, height: 180, borderRadius: 20, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.amber}18, ${C.emerald}12)`,
            border: `1px solid ${C.amber}30`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Users size={36} color="#b45309" />
            <div style={{ fontSize: 26, fontWeight: 900, color: C.gray900 }}>28M+</div>
            <div style={{ fontSize: 11, color: C.gray700, textAlign: "center" }}>Uninsured Americans</div>
          </div>
        </div>
      </section>

      <section style={{
        padding: "72px 32px",
        background: `linear-gradient(180deg, ${C.white} 0%, ${C.gray50} 100%)`,
        textAlign: "center",
      }}>
        <h2 style={{ fontSize: 38, fontWeight: 900, color: C.gray900, letterSpacing: "-0.03em", margin: "0 0 14px" }}>
          Own Your Health Story
        </h2>
        <p style={{ fontSize: 16, color: C.gray500, margin: "0 0 28px", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
          Free, HIPAA-compliant, and available worldwide.
        </p>
        <Button size="lg" style={{
          height: 52, padding: "0 36px", fontSize: 16, fontWeight: 700, borderRadius: 12,
          background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoLight})`,
          boxShadow: `0 0 40px rgba(79,70,229,0.3)`,
        }}>
          Get Started Free <ArrowRight size={18} style={{ marginLeft: 8 }} />
        </Button>
      </section>

      <footer style={{
        padding: "20px 32px", borderTop: `1px solid ${C.gray200}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 13, color: C.gray500,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileHeart size={14} color={C.gray500} />
          &copy; 2026 Tabula Medica
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="#" style={{ color: C.gray500, textDecoration: "none" }}>Privacy</a>
          <a href="#" style={{ color: C.gray500, textDecoration: "none" }}>Terms</a>
          <a href="#" style={{ color: C.gray500, textDecoration: "none" }}>Security</a>
          <a href="#" style={{ color: C.gray500, textDecoration: "none" }}>Contact</a>
        </div>
      </footer>
    </div>
  );
}
