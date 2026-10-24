/** RTL languages shipped in `shared/i18n.ts` and the language provider. */
const RTL_BASE_CODES = new Set(["ar", "fa", "ur", "he", "ps"]);

export function textDirection(code: string | null | undefined): "ltr" | "rtl" {
  const base = (code ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return RTL_BASE_CODES.has(base) ? "rtl" : "ltr";
}
