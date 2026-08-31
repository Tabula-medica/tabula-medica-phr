import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";
import { Loader2, Search, Tag, MapPin } from "lucide-react";

type Category = "LAB" | "IMAGING" | "RX";
const CATEGORIES: { id: Category; label: string; placeholder: string }[] = [
  { id: "LAB", label: "Lab tests", placeholder: "e.g., Lipid panel, A1C, CBC" },
  { id: "IMAGING", label: "Imaging", placeholder: "e.g., MRI knee, CT chest, X-ray" },
  { id: "RX", label: "Prescriptions", placeholder: "e.g., atorvastatin, metformin" },
];

interface Quote { id?: string; name: string; cashPrice: number; loc?: string }

/**
 * Cash Prices — a "shop the cash price for labs / imaging / Rx near you" tab,
 * powered by the Underinsured marketplace via the PHR's same-origin proxy
 * (/api/marketplace/price-lookup). Public, non-PHI pricing. Fail-safe: an
 * unreachable/unconfigured upstream renders a clean empty state.
 */
export default function CashPrices() {
  useSEO({ title: "Cash Prices | Tabula Medica", description: "Shop transparent cash prices for labs, imaging, and prescriptions near you." });
  const { toast } = useToast();
  const [category, setCategory] = useState<Category>("LAB");
  const [q, setQ] = useState("");
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  const active = CATEGORIES.find((c) => c.id === category)!;
  const usd = (n: number) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const search = async () => {
    if (!q.trim()) {
      toast({ title: "Enter a service", description: `Type a ${active.label.toLowerCase()} name to compare prices.` });
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ category, q: q.trim() });
      if (zip.trim()) params.set("zip", zip.trim());
      const resp = await fetch(`/api/marketplace/price-lookup?${params.toString()}`, { credentials: "include" });
      const data = resp.ok ? await resp.json() : { quotes: [] };
      const list: Quote[] = (data.quotes || data.results || []).filter((x: any) => x && typeof x.cashPrice === "number");
      list.sort((a, b) => a.cashPrice - b.cashPrice);
      setQuotes(list);
      setSearched(true);
    } catch {
      setQuotes([]);
      setSearched(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Tag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cash prices near you</h1>
          <p className="text-sm text-muted-foreground">Transparent, upfront prices — no insurance needed.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">What are you looking for?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant={category === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => { setCategory(c.id); setSearched(false); setQuotes([]); }}
                data-testid={`button-category-${c.id.toLowerCase()}`}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-1.5">
              <Label>{active.label}</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={active.placeholder}
                onKeyDown={(e) => e.key === "Enter" && search()} data-testid="input-service" />
            </div>
            <div className="space-y-1.5">
              <Label>ZIP (optional)</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} inputMode="numeric" placeholder="22314" data-testid="input-zip" />
            </div>
          </div>
          <Button className="w-full" onClick={search} disabled={busy || !q.trim()} data-testid="button-search-prices">
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching…</> : <><Search className="h-4 w-4 mr-2" />Compare prices</>}
          </Button>
        </CardContent>
      </Card>

      {searched && (
        quotes.length > 0 ? (
          <div className="space-y-2" data-testid="list-quotes">
            {quotes.map((qt, i) => (
              <Card key={qt.id || i} className={i === 0 ? "border-green-500/40" : ""}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{qt.name}</div>
                    {qt.loc && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{qt.loc}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-semibold">{usd(qt.cashPrice)}</div>
                    {i === 0 && <Badge variant="secondary" className="text-xs">Lowest</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
            <p className="text-xs text-muted-foreground pt-1">Cash prices sourced from the Underinsured marketplace. Prices vary; confirm with the provider before booking.</p>
          </div>
        ) : (
          <Card><CardContent className="p-8 text-center text-muted-foreground" data-testid="empty-quotes">
            No cash prices found for “{q}”. Try a broader term or a nearby ZIP.
          </CardContent></Card>
        )
      )}
    </div>
  );
}
