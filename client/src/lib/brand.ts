// Build-time brand selection. The same codebase ships as Tabula Medica (default)
// and as Vista PD (VITE_BRAND=vista, deployed by deploy-vista.sh to vista-pd.com).
export type BrandId = "tabula" | "vista";

export const BRAND_ID: BrandId = import.meta.env.VITE_BRAND === "vista" ? "vista" : "tabula";

export const IS_VISTA = BRAND_ID === "vista";

const BRANDS: Record<BrandId, { name: string }> = {
  tabula: { name: "Tabula Medica" },
  vista: { name: "Vista PD" },
};

export const BRAND = BRANDS[BRAND_ID];
