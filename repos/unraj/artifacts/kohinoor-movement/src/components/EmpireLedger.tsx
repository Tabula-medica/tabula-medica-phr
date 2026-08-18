import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { BookOpen, ChevronDown, ScrollText } from "lucide-react";
import { EMPIRE_LEDGER, LEDGER_REGIONS, type LedgerEntry } from "@/data/empire-ledger";

function LedgerCard({ entry, index }: { entry: LedgerEntry; index: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.4) }}
      className="bg-white/[0.02] border border-white/10 hover:border-primary/30 rounded-2xl overflow-hidden transition-colors duration-500"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left p-5 md:p-6 flex items-start gap-4"
      >
        <span className="text-3xl md:text-4xl leading-none select-none" aria-hidden="true">
          {entry.flag}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg md:text-xl font-bold text-white font-serif">{entry.country}</h3>
            <span className="text-[11px] font-bold tracking-wider uppercase text-primary/70">
              {entry.ruleYears}
            </span>
          </div>
          <p className="text-[11px] font-semibold tracking-wide uppercase text-white/30 mt-0.5">
            {entry.region} · {entry.colonyType}
          </p>
          <p className="text-white/60 text-sm font-light leading-relaxed mt-3">{entry.summary}</p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-white/40 shrink-0 mt-1 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 md:px-6 pb-6 pl-[4.25rem] space-y-5">
              <ol className="space-y-3 border-l border-white/10 pl-5">
                {entry.events.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[1.42rem] top-1.5 w-2 h-2 rounded-full bg-primary/60" aria-hidden="true" />
                    <span className="text-primary/80 text-xs font-bold tracking-wider uppercase">{e.year}</span>
                    <p className="text-white/60 text-sm font-light leading-relaxed mt-0.5">{e.text}</p>
                  </li>
                ))}
              </ol>

              <div>
                <p className="text-[10px] font-bold tracking-wider uppercase text-white/30 mb-1">
                  {t("ledger.taken")}
                </p>
                <p className="text-amber-500/60 text-sm font-medium leading-relaxed">{entry.taken}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold tracking-wider uppercase text-white/30 mb-2 flex items-center gap-1.5">
                  <ScrollText className="w-3 h-3" /> {t("ledger.sources")}
                </p>
                <ul className="space-y-1">
                  {entry.sources.map((s, i) => (
                    <li key={i} className="text-white/40 text-xs leading-relaxed pl-3 border-l border-white/10">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function EmpireLedger() {
  const { t } = useTranslation();
  const [region, setRegion] = useState<string>("All");

  const entries =
    region === "All" ? EMPIRE_LEDGER : EMPIRE_LEDGER.filter((e) => e.region === region);

  return (
    <section id="ledger" className="py-24 md:py-36 px-6 relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a12] to-black" />

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="text-center mb-14"
        >
          <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 tracking-tighter">
            {t("ledger.title")}
          </h2>
          <p className="text-base md:text-lg text-white/50 font-light max-w-3xl mx-auto leading-relaxed">
            {t("ledger.subtitle")}
          </p>
          <p className="text-xs md:text-sm text-primary/50 font-medium max-w-2xl mx-auto leading-relaxed mt-4 flex items-center justify-center gap-2">
            <ScrollText className="w-4 h-4 shrink-0" />
            {t("ledger.authenticatedNote")}
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {LEDGER_REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all duration-300 border ${
                region === r
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/[0.02] border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
              }`}
            >
              {r === "All" ? t("ledger.filterAll") : r}
            </button>
          ))}
        </div>

        <motion.div layout className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AnimatePresence mode="popLayout">
            {entries.map((entry, i) => (
              <LedgerCard key={entry.id} entry={entry} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center text-white/40 text-sm font-light max-w-3xl mx-auto leading-relaxed mt-16"
        >
          {t("ledger.closing")}
        </motion.p>
      </div>
    </section>
  );
}
