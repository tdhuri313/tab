/**
 * Cents → "$400.00". With `short`, whole amounts drop the cents ("$400") —
 * nicer in a sentence; tables keep the cents so columns line up.
 */
export function formatMoney(cents: number, currency: string, { short = false } = {}) {
  const wholeOnly = short && cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: wholeOnly ? 0 : 2,
  }).format(cents / 100);
}

/** Unix seconds → "just now", "5 minutes ago", "yesterday", "2 days ago". */
export function formatTimeAgo(thenSeconds: number, nowSeconds: number) {
  const diff = Math.max(0, nowSeconds - thenSeconds);
  if (diff < 60) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  if (diff < 3_600) return rtf.format(-Math.floor(diff / 60), "minute");
  if (diff < 86_400) return rtf.format(-Math.floor(diff / 3_600), "hour");
  return rtf.format(-Math.floor(diff / 86_400), "day");
}
