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
