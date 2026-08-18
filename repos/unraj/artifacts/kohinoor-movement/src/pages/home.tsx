import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, animate, useInView, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { 
  History, 
  Globe2, 
  Scale, 
  FileSignature, 
  Share2, 
  CheckCircle2,
  ChevronDown,
  Users,
  MapPin,
  Megaphone,
  Smartphone,
  Wallet,
  Flag,
  Gavel,
  Handshake,
  Menu,
  X,
  Skull,
  Gem,
  Landmark,
  Scroll,
  Compass,
  Anchor,
  Lock,
  BarChart3,
  Twitter,
  MessageCircle,
  Link2,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LanguageSelector from "@/components/LanguageSelector";
import EmpireLedger from "@/components/EmpireLedger";

const COUNTRIES = [
  "India", "United Kingdom", "United States", "Canada", "Australia",
  "Pakistan", "Bangladesh", "Sri Lanka", "Nepal", "South Africa",
  "Germany", "France", "Netherlands", "UAE", "Saudi Arabia",
  "Singapore", "Malaysia", "Kenya", "Nigeria", "Trinidad and Tobago",
  "Fiji", "Mauritius", "Guyana", "Suriname", "New Zealand",
  "Ireland", "Scotland", "Wales", "Japan", "Brazil",
  "Italy", "Spain", "Sweden", "Norway", "Denmark",
  "Belgium", "Switzerland", "Austria", "Portugal", "Philippines",
  "Indonesia", "Thailand", "Myanmar", "China", "Russia",
  "Mexico", "Argentina", "Colombia", "Egypt", "Other"
];


function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView) return;
    if (hasAnimated.current) {
      setCount(target);
      return;
    }
    hasAnimated.current = true;
    const controls = animate(0, target, {
      duration: 2.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setCount(Math.floor(v)),
    });
    return () => controls.stop();
  }, [target, isInView]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString()}
    </span>
  );
}


function SectionDivider() {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/30" />
      <div className="w-2 h-2 rounded-full bg-primary/40 mx-4" />
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/30" />
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const [pledgeSubmitted, setPledgeSubmitted] = useState(false);
  const [pledgeError, setPledgeError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [liveSignatureCount, setLiveSignatureCount] = useState(0);
  const [countryCount, setCountryCount] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 1.1]);

  const goalCount = 1_000_000_000;
  const progressPercent = (liveSignatureCount / goalCount) * 100;

  const API_BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, '/').replace(/^\//, '/');

  const fetchCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/signatures/count`);
      if (res.ok) {
        const data = await res.json();
        setLiveSignatureCount(data.count);
        setCountryCount(data.countries);
      }
    } catch (e) {
      console.error("Failed to fetch signature count:", e);
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setNavScrolled(y > 80);
      setShowStickyBar(y > window.innerHeight * 0.9);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handlePledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const email = formData.get("email") as string;
    const country = formData.get("country") as string;
    const website = formData.get("website") as string;
    const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
    if (!name || !email?.trim()) return;
    setPledgeError(null);
    try {
      const res = await fetch(`${API_BASE}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), country: country?.trim() || null, website: website || "" }),
      });
      if (!res.ok && res.status !== 202) {
        const data = await res.json().catch(() => ({}));
        setPledgeError((data as { error?: string }).error ?? "Something went wrong. Please try again.");
        return;
      }
    } catch (e) {
      console.error("Failed to submit signature:", e);
      setPledgeError("Unable to reach the server. Please try again.");
      return;
    }
    setPledgeSubmitted(true);
  };

  const navLinks = [
    { href: "#history", label: t("nav.history"), color: "hover:text-primary" },
    { href: "#plunder", label: t("nav.plunder"), color: "hover:text-red-500" },
    { href: "#ledger", label: t("nav.ledger"), color: "hover:text-primary" },
    { href: "#pledge", label: t("nav.takeAction"), color: "hover:text-primary" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-hidden font-sans">
      <motion.nav
        className={`fixed top-0 w-full z-50 px-6 md:px-10 py-4 flex justify-between items-center transition-all duration-500 ${
          navScrolled ? "glass" : "bg-transparent"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <a href="#" className="font-serif font-black text-2xl md:text-3xl tracking-tighter text-white relative group">
          Un<span className="text-primary">Raj</span>.
          <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
        </a>
        
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden lg:flex gap-6 text-[13px] font-semibold tracking-wider uppercase">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className={`text-white/70 ${link.color} transition-all duration-300 relative group`}>
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-current transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>
          <div className="hidden sm:block">
            <LanguageSelector />
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="lg:hidden text-white p-2"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 glass pt-20"
          >
            <div className="flex flex-col items-center gap-8 p-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-white text-2xl font-serif font-bold"
                >
                  {link.label}
                </a>
              ))}
              <div className="sm:hidden mt-4">
                <LanguageSelector />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="relative h-[100dvh] flex flex-col justify-center items-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 z-0 bg-black">
          <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className="w-full h-full">
            <img
              src="/images/hero-kohinoor.png" 
              alt="The Kohinoor Diamond" 
              className="w-full h-full object-cover opacity-60"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.55)_70%)]" />
        </div>
        
        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <span className="inline-block text-primary font-bold tracking-[0.3em] uppercase text-xs md:text-sm mb-8 border border-primary/30 px-6 py-2 rounded-full bg-primary/5 backdrop-blur-sm">
              {t("hero.subtitle")}
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-[3.5rem] md:text-8xl lg:text-[10rem] font-black text-white leading-[0.85] tracking-tighter mb-8 [text-shadow:_0_4px_30px_rgb(0_0_0_/_60%)]"
          >
            {t("hero.title1")} <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-yellow-400 to-primary text-glow-primary">
              {t("hero.title2")}
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="text-base md:text-xl lg:text-2xl text-white/75 max-w-2xl mx-auto font-light leading-relaxed mb-10 [text-shadow:_0_2px_10px_rgb(0_0_0_/_70%)]"
          >
            {t("hero.description")}
          </motion.p>

          {liveSignatureCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.3 }}
              className="inline-flex items-center gap-3 mb-8 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <span className="text-white/90 text-sm md:text-base font-medium tabular-nums">
                <span className="text-primary font-bold">{liveSignatureCount.toLocaleString()}</span>
                {" "}{t("counter.signed")} · {countryCount} {countryCount === 1 ? "country" : "countries"}
              </span>
            </motion.div>
          )}
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.5 }}
            className="flex flex-col sm:flex-row gap-4 items-center justify-center"
          >
            <a href="#pledge">
              <Button data-testid="button-sign-declaration" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base md:text-lg px-10 py-7 rounded-full font-bold uppercase tracking-wider animate-pulse-glow">
                {t("hero.cta")}
              </Button>
            </a>
            <a
              href="#history"
              className="group inline-flex items-center gap-2 text-white/70 hover:text-white text-sm md:text-base font-semibold tracking-wider uppercase px-6 py-3 transition-colors"
            >
              {t("hero.readMore", "Read the Story")}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
          </motion.div>
        </div>

        <motion.div 
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-8 z-10"
        >
          <ChevronDown className="w-7 h-7 text-white/30" />
        </motion.div>
      </section>

      <section id="history" className="py-24 md:py-40 px-6 md:px-12 bg-background relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[150px]" />
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 1 }}
            >
              <SectionDivider />
              <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold mb-8 text-foreground mt-6">
                {t("history.title1")} <br/>{t("history.title2")}
              </h2>
              <div className="space-y-6 text-lg md:text-xl text-muted-foreground font-light leading-relaxed">
                <p>{t("history.p1")}</p>
                <p>{t("history.p2")}</p>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2 }}
              className="relative"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-2xl">
                <img 
                  src="/images/architecture.png" 
                  alt="Indian Architecture" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="absolute -bottom-6 -left-6 w-32 h-32 border-2 border-primary/20 rounded-3xl -z-10" />
              <div className="absolute -top-6 -right-6 w-24 h-24 border-2 border-primary/10 rounded-2xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 md:py-40 px-6 md:px-12 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-16 h-16 mx-auto mb-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <History className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold mb-10 text-white">
              {t("seizure.title")}
            </h2>
            <p className="text-lg md:text-xl text-white/50 font-light leading-relaxed mb-14 max-w-3xl mx-auto">
              {t("seizure.p1")}
            </p>
            <div className="relative max-w-2xl mx-auto">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/60 to-primary/10 rounded-full" />
              <p className="text-xl md:text-2xl text-primary font-medium italic pl-8 text-left leading-relaxed">
                {t("seizure.quote")}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="justice" className="py-24 md:py-40 px-6 md:px-12 bg-background relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-[150px]" />
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="order-2 lg:order-1 relative"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-2xl">
                <img 
                  src="/images/protest.png" 
                  alt="Protest Movement" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            </motion.div>

            <div className="order-1 lg:order-2">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <SectionDivider />
                <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold mb-14 text-foreground mt-6">
                  {t("justice.title")}
                </h2>
              </motion.div>
              
              <div className="space-y-10">
                {[
                  { icon: Scale, titleKey: "justice.historicalJustice", descKey: "justice.historicalJusticeDesc" },
                  { icon: Globe2, titleKey: "justice.culturalSovereignty", descKey: "justice.culturalSovereigntyDesc" },
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.15 }}
                    className="flex gap-5 group"
                  >
                    <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 font-serif">{t(item.titleKey)}</h3>
                      <p className="text-muted-foreground text-base font-light leading-relaxed">
                        {t(item.descKey)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="plunder" className="py-24 md:py-36 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#080810] to-black" />
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0" style={{
            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,0,0,0.06) 40px, rgba(255,0,0,0.06) 41px)",
          }} />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="text-center mb-20"
          >
            <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-red-500/10 border border-red-500/15 flex items-center justify-center">
              <Skull className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="font-serif text-4xl md:text-6xl lg:text-8xl font-black text-white mb-6 tracking-tighter">
              {t("plunder.title")}
            </h2>
            <p className="text-base md:text-lg text-white/50 font-light max-w-3xl mx-auto leading-relaxed">
              {t("plunder.subtitle")}
            </p>
          </motion.div>

          <div className="space-y-6">
            {[
              { icon: Gem, regionKey: "india", itemsKey: "indiaItems", yearKey: "indiaYear", descKey: "indiaDesc", accent: "primary", highlight: true },
              { icon: Landmark, regionKey: "africa", itemsKey: "africaItems", yearKey: "africaYear", descKey: "africaDesc", accent: "amber" },
              { icon: Scroll, regionKey: "middleEast", itemsKey: "middleEastItems", yearKey: "middleEastYear", descKey: "middleEastDesc", accent: "blue" },
              { icon: Compass, regionKey: "china", itemsKey: "chinaItems", yearKey: "chinaYear", descKey: "chinaDesc", accent: "rose" },
              { icon: Anchor, regionKey: "pacific", itemsKey: "pacificItems", yearKey: "pacificYear", descKey: "pacificDesc", accent: "emerald" },
              { icon: Globe2, regionKey: "americas", itemsKey: "americasItems", yearKey: "americasYear", descKey: "americasDesc", accent: "violet" },
            ].map((item, i) => {
              const accentColors: Record<string, { border: string; iconBg: string; icon: string; year: string; items: string }> = {
                primary: { border: "border-primary/20 hover:border-primary/40", iconBg: "bg-primary/10", icon: "text-primary", year: "text-primary/70", items: "text-primary/50" },
                amber: { border: "border-amber-500/20 hover:border-amber-500/40", iconBg: "bg-amber-500/10", icon: "text-amber-500", year: "text-amber-500/70", items: "text-amber-500/50" },
                blue: { border: "border-blue-400/20 hover:border-blue-400/40", iconBg: "bg-blue-400/10", icon: "text-blue-400", year: "text-blue-400/70", items: "text-blue-400/50" },
                rose: { border: "border-rose-400/20 hover:border-rose-400/40", iconBg: "bg-rose-400/10", icon: "text-rose-400", year: "text-rose-400/70", items: "text-rose-400/50" },
                emerald: { border: "border-emerald-400/20 hover:border-emerald-400/40", iconBg: "bg-emerald-400/10", icon: "text-emerald-400", year: "text-emerald-400/70", items: "text-emerald-400/50" },
                violet: { border: "border-violet-400/20 hover:border-violet-400/40", iconBg: "bg-violet-400/10", icon: "text-violet-400", year: "text-violet-400/70", items: "text-violet-400/50" },
              };
              const colors = accentColors[item.accent];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className={`bg-white/[0.02] border ${colors.border} rounded-3xl p-6 md:p-10 transition-all duration-500 group ${item.highlight ? "ring-1 ring-primary/10" : ""}`}
                >
                  <div className="flex flex-col md:flex-row gap-6 md:gap-10">
                    <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-3 shrink-0 md:w-48">
                      <div className={`w-12 h-12 rounded-2xl ${colors.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <item.icon className={`w-6 h-6 ${colors.icon}`} />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-bold text-white font-serif">{t(`plunder.${item.regionKey}`)}</h3>
                        <p className={`text-xs font-bold tracking-wider uppercase mt-1 ${colors.year}`}>{t(`plunder.${item.yearKey}`)}</p>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="text-white/60 text-sm md:text-base font-light leading-relaxed">
                        {t(`plunder.${item.descKey}`)}
                      </p>
                      <p className={`text-xs font-medium tracking-wide ${colors.items} leading-relaxed`}>
                        {t(`plunder.${item.itemsKey}`)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-24"
          >
            <div className="text-center mb-12">
              <h3 className="font-serif text-3xl md:text-5xl font-black text-white mb-4 tracking-tighter">
                {t("plunder.museumsTitle")}
              </h3>
              <p className="text-base md:text-lg text-white/50 font-light max-w-3xl mx-auto leading-relaxed">
                {t("plunder.museumsSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { artifact: "Koh-i-Noor Diamond", origin: "India", museum: "Tower of London", country: "United Kingdom" },
                { artifact: "Benin Bronzes", origin: "Nigeria", museum: "British Museum", country: "United Kingdom" },
                { artifact: "Rosetta Stone", origin: "Egypt", museum: "British Museum", country: "United Kingdom" },
                { artifact: "Parthenon (Elgin) Marbles", origin: "Greece", museum: "British Museum", country: "United Kingdom" },
                { artifact: "Bust of Nefertiti", origin: "Egypt", museum: "Neues Museum, Berlin", country: "Germany" },
                { artifact: "Hoa Hakananaʻia (Moai)", origin: "Rapa Nui, Chile", museum: "British Museum", country: "United Kingdom" },
                { artifact: "Maqdala Treasures & Tabots", origin: "Ethiopia", museum: "V&A Museum", country: "United Kingdom" },
                { artifact: "Summer Palace Bronzes", origin: "China", museum: "Château de Fontainebleau", country: "France" },
              ].map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: (i % 2) * 0.08 }}
                  className="bg-white/[0.02] border border-white/[0.06] hover:border-red-500/30 rounded-2xl p-6 transition-all duration-500 group"
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <h4 className="font-serif text-lg md:text-xl font-bold text-white leading-snug">
                      {m.artifact}
                    </h4>
                    <span className="shrink-0 text-[10px] font-bold tracking-wider uppercase text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1">
                      {t("plunder.museumStatus")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-emerald-400/70 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold tracking-wider uppercase text-white/30">{t("plunder.museumOrigin")}</p>
                        <p className="text-sm text-white/70 font-medium truncate">{m.origin}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ArrowRight className="w-4 h-4 text-red-500/60 shrink-0" />
                      <Landmark className="w-4 h-4 text-amber-500/70 shrink-0 -ml-1" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold tracking-wider uppercase text-white/30">{t("plunder.museumHeldAt")}</p>
                        <p className="text-sm text-white/70 font-medium">{m.museum} <span className="text-white/40">· {m.country}</span></p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-20"
          >
            <div className="bg-gradient-to-r from-red-950/30 via-black to-red-950/30 border border-red-500/10 rounded-3xl p-8 md:p-14">
              <h3 className="font-serif text-2xl md:text-4xl font-black text-white mb-10 text-center">
                {t("plunder.totalTitle")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { icon: Landmark, text: t("plunder.totalMuseum") },
                  { icon: Lock, text: t("plunder.totalPercent") },
                  { icon: Globe2, text: t("plunder.totalCountries") },
                  { icon: BarChart3, text: t("plunder.totalValue") },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                    className="flex items-start gap-4 bg-white/[0.03] rounded-2xl p-5 border border-white/[0.04]"
                  >
                    <stat.icon className="w-5 h-5 text-red-500/70 shrink-0 mt-0.5" />
                    <p className="text-white/70 text-sm md:text-base font-medium leading-snug">{stat.text}</p>
                  </motion.div>
                ))}
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.8 }}
                className="text-center mt-10 text-lg md:text-xl text-red-400/80 font-bold italic font-serif leading-relaxed max-w-3xl mx-auto"
              >
                {t("plunder.closing")}
              </motion.p>
            </div>
          </motion.div>
        </div>
      </section>

      <EmpireLedger />

      <section className="relative h-[50vh] md:h-[70vh] overflow-hidden">
        <div className="absolute inset-0 bg-black">
          <img
            src="/images/heritage-detail.png"
            alt="Heritage Detail" 
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center text-center px-6">
          <motion.h2
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2 }}
            className="font-serif text-3xl md:text-5xl lg:text-7xl text-white font-bold tracking-tight max-w-5xl leading-tight"
          >
            {t("parallax.title")}
          </motion.h2>
        </div>
      </section>


      <section className="py-24 md:py-36 px-6 bg-black relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,165,0,0.5) 1px, transparent 0)",
            backgroundSize: "50px 50px"
          }} />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="text-center mb-20"
          >
            <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Megaphone className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 tracking-tighter">
              {t("diaspora.title")}
            </h2>
            <p className="text-lg md:text-xl text-white/40 font-light max-w-3xl mx-auto leading-relaxed">
              {t("diaspora.subtitle")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {[
              { icon: Flag, titleKey: "diaspora.call1title", descKey: "diaspora.call1desc", accent: "red" },
              { icon: Smartphone, titleKey: "diaspora.call2title", descKey: "diaspora.call2desc", accent: "primary" },
              { icon: Wallet, titleKey: "diaspora.call3title", descKey: "diaspora.call3desc", accent: "green" },
            ].map((item, i) => {
              const colors = {
                red: { bg: "from-red-500/10 to-transparent", border: "border-red-500/15 hover:border-red-500/30", icon: "text-red-500", iconBg: "bg-red-500/10" },
                primary: { bg: "from-primary/10 to-transparent", border: "border-primary/15 hover:border-primary/30", icon: "text-primary", iconBg: "bg-primary/10" },
                green: { bg: "from-emerald-500/10 to-transparent", border: "border-emerald-500/15 hover:border-emerald-500/30", icon: "text-emerald-500", iconBg: "bg-emerald-500/10" },
              }[item.accent]!;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.12 }}
                  className={`bg-gradient-to-b ${colors.bg} border ${colors.border} rounded-3xl p-8 md:p-10 transition-all duration-500 group`}
                >
                  <div className={`w-14 h-14 rounded-2xl ${colors.iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <item.icon className={`w-7 h-7 ${colors.icon}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3 font-serif">{t(item.titleKey)}</h3>
                  <p className="text-white/40 font-light leading-relaxed text-sm">{t(item.descKey)}</p>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-center"
          >
            <div className="relative max-w-3xl mx-auto">
              <div className="absolute left-1/2 -translate-x-1/2 -top-4 w-12 h-1 bg-primary/30 rounded-full" />
              <p className="text-xl md:text-2xl text-primary font-bold italic font-serif pt-6 leading-relaxed">
                {t("diaspora.rallyCry")}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-24 md:py-36 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a1a] to-black" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/15 blur-[200px]" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="text-center mb-20"
          >
            <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl font-black text-white mb-4 tracking-tighter">
              {t("unraj.title")}
            </h2>
            <p className="text-lg md:text-xl text-blue-400/60 font-bold mb-4">
              {t("unraj.subtitle")}
            </p>
            <p className="text-base text-white/40 font-light max-w-2xl mx-auto">
              {t("unraj.appeal")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[
              { icon: Globe2, titleKey: "unraj.point1title", descKey: "unraj.point1desc" },
              { icon: Gavel, titleKey: "unraj.point2title", descKey: "unraj.point2desc" },
              { icon: Handshake, titleKey: "unraj.point3title", descKey: "unraj.point3desc" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="bg-white/[0.03] border border-white/[0.06] hover:border-blue-400/20 rounded-3xl p-8 md:p-10 transition-all duration-500 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <item.icon className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3 font-serif">{t(item.titleKey)}</h3>
                <p className="text-white/50 font-light leading-relaxed text-sm">{t(item.descKey)}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative bg-gradient-to-r from-blue-950/40 to-red-950/40 border border-white/[0.06] rounded-3xl p-8 md:p-14 text-center overflow-hidden"
          >
            <div className="absolute inset-0 animate-shimmer" />
            <p className="relative text-lg md:text-2xl text-white/90 font-bold italic font-serif leading-relaxed">
              {t("unraj.trumpQuote")}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-24 md:py-36 px-6 bg-black relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,165,0,0.4) 1px, transparent 0)",
            backgroundSize: "40px 40px"
          }} />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 tracking-tight">
              {t("counter.heading")}
            </h2>
            <p className="text-xl md:text-3xl text-primary font-bold mb-20 tracking-tight text-glow-primary">
              {t("counter.subheading")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mb-16"
          >
            <div className="text-6xl md:text-8xl lg:text-9xl font-black text-primary font-serif tracking-tighter mb-8 text-glow-primary">
              <AnimatedCounter target={liveSignatureCount} />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-white/40 text-base md:text-lg">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary/60" />
                <span>{t("counter.signed")}</span>
              </div>
              <div className="hidden sm:block w-px h-5 bg-white/10" />
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary/60" />
                <span>{t("counter.fromCountries", { count: countryCount })}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.5 }}
            className="max-w-2xl mx-auto"
          >
            <div className="relative h-3 bg-white/[0.06] rounded-full overflow-hidden mb-3">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${progressPercent}%` }}
                viewport={{ once: true }}
                transition={{ duration: 2.5, delay: 0.8, ease: "easeOut" }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-yellow-400 rounded-full"
              />
            </div>
            <p className="text-white/50 text-xs font-bold tracking-[0.2em] uppercase">
              {t("counter.goal")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 1 }}
            className="mt-14"
          >
            <a href="#pledge">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-12 py-7 rounded-full font-bold uppercase tracking-wider animate-pulse-glow">
                {t("counter.joinThem")}
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      <section id="pledge" className="py-24 md:py-36 px-6 md:px-12 bg-foreground text-background relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[200px]" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-14"
          >
            <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileSignature className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-white">{t("pledge.title")}</h2>
            <p className="text-base md:text-lg text-white/40 font-light max-w-2xl mx-auto leading-relaxed">
              {t("pledge.description")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-primary/5 border border-primary/15 rounded-2xl p-6 mb-10 text-center"
          >
            <p className="text-primary/80 text-sm md:text-base font-medium italic leading-relaxed">
              {t("pledge.ukNote")}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-white/[0.03] p-8 md:p-14 rounded-3xl border border-white/[0.06]"
          >
            {pledgeSubmitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-24 h-24 mx-auto mb-8 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                </motion.div>
                <h3 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
                  {t("pledge.checkEmailTitle", "Check Your Email")}
                </h3>
                <p className="text-lg text-white/40 max-w-md mx-auto">
                  {t("pledge.checkEmailMessage", "We've sent a confirmation link to your inbox. Click it to verify your signature and join the movement.")}
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handlePledgeSubmit} className="space-y-5">
                <div className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
                  <label htmlFor="website">Leave this field empty</label>
                  <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white/50 text-xs font-bold tracking-wider uppercase">{t("pledge.firstName")}</Label>
                    <Input data-testid="input-first-name" id="firstName" name="firstName" required className="bg-white/[0.04] border-white/[0.08] text-white focus:border-primary/50 h-13 rounded-xl text-base placeholder:text-white/20" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-white/50 text-xs font-bold tracking-wider uppercase">{t("pledge.lastName")}</Label>
                    <Input data-testid="input-last-name" id="lastName" name="lastName" required className="bg-white/[0.04] border-white/[0.08] text-white focus:border-primary/50 h-13 rounded-xl text-base placeholder:text-white/20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/50 text-xs font-bold tracking-wider uppercase">{t("pledge.email")}</Label>
                  <Input data-testid="input-email" id="email" name="email" type="email" required className="bg-white/[0.04] border-white/[0.08] text-white focus:border-primary/50 h-13 rounded-xl text-base placeholder:text-white/20" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-white/50 text-xs font-bold tracking-wider uppercase">{t("pledge.country")}</Label>
                    <select 
                      data-testid="select-country"
                      id="country"
                      name="country"
                      required 
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white focus:border-primary/50 h-13 rounded-xl px-4 appearance-none cursor-pointer text-base"
                      defaultValue=""
                    >
                      <option value="" disabled className="bg-gray-900 text-white/40">{t("pledge.selectCountry")}</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c} className="bg-gray-900">{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-white/50 text-xs font-bold tracking-wider uppercase">{t("pledge.city")}</Label>
                    <Input data-testid="input-city" id="city" className="bg-white/[0.04] border-white/[0.08] text-white focus:border-primary/50 h-13 rounded-xl text-base placeholder:text-white/20" />
                  </div>
                </div>
                {pledgeError && (
                  <p className="text-sm text-red-400 text-center" role="alert">
                    {pledgeError}
                  </p>
                )}
                <div className="pt-4">
                  <Button data-testid="button-submit-pledge" type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-7 rounded-2xl font-bold tracking-wider uppercase animate-pulse-glow">
                    {t("pledge.submit")}
                  </Button>
                </div>
                <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-primary/70 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      {t("pledge.disclaimer")}
                    </p>
                  </div>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      <AnimatePresence>
        {showStickyBar && !pledgeSubmitted && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-black/85 backdrop-blur-xl border-t border-primary/20 px-4 sm:px-6 py-3 sm:py-4"
          >
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 sm:gap-6">
              <div className="flex items-center gap-3 min-w-0">
                <span className="relative hidden sm:flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <div className="min-w-0">
                  <div className="text-white font-bold text-base sm:text-lg leading-tight tabular-nums truncate">
                    <span className="text-primary">{liveSignatureCount.toLocaleString()}</span>
                    <span className="text-white/60 font-normal text-xs sm:text-sm ml-2 hidden sm:inline">
                      {t("counter.signed")} · {countryCount} {countryCount === 1 ? "country" : "countries"}
                    </span>
                  </div>
                  <div className="text-white/50 text-[10px] sm:hidden uppercase tracking-wider font-semibold">
                    {t("counter.signed")}
                  </div>
                </div>
              </div>
              <a href="#pledge" className="shrink-0">
                <Button
                  data-testid="button-sticky-sign"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-5 sm:px-8 py-5 sm:py-6 rounded-full font-bold text-sm sm:text-base uppercase tracking-wider"
                >
                  {t("hero.cta")}
                </Button>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="bg-black py-20 px-6 border-t border-white/[0.06] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
            backgroundSize: "30px 30px"
          }} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <a href="#" className="inline-block font-serif font-black text-4xl tracking-tighter text-white mb-6 group">
            Un<span className="text-primary">Raj</span>.
          </a>
          <p className="text-red-500/80 font-black text-lg md:text-xl tracking-[0.15em] uppercase mb-4">
            {t("footer.slogan")}
          </p>
          <p className="text-primary/50 font-semibold text-base italic mb-8">
            {t("footer.tagline")}
          </p>
          <p className="text-white/50 text-sm mb-10 max-w-md mx-auto leading-relaxed">
            {t("footer.description")}
          </p>
          <div className="flex justify-center gap-8">
            {["footer.twitter", "footer.instagram", "footer.share"].map((key) => (
              <a key={key} href="#" className="text-white/50 hover:text-primary transition-colors uppercase text-[11px] font-bold tracking-[0.2em]">{t(key)}</a>
            ))}
          </div>
          <div className="mt-12 pt-8 border-t border-white/[0.04] flex flex-col items-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <a href="/privacy" className="text-white/40 hover:text-primary transition-colors text-xs font-medium tracking-wide">Privacy Policy</a>
              <a
                href="https://tabula-legal.pages.dev/unraj/terms.html"
                target="_blank"
                rel="noopener"
                className="text-white/40 hover:text-primary transition-colors text-xs font-medium tracking-wide"
              >
                Terms of Service
              </a>
            </div>
            <p className="text-white/40 text-xs">&copy; {new Date().getFullYear()} UnRaj.org — All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
