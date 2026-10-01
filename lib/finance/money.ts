/**
 * Presentation-only money formatting.
 *
 * Authoritative financial values are integer minor units in the database.
 * This helper formats them for display; it performs no financial
 * calculations (totals, balances, progress are later-phase server/domain
 * concerns).
 */
export function formatMinorUnits(amountMinorUnits: bigint, currency: string): string {
  const negative = amountMinorUnits < 0n;
  const absolute = negative ? -amountMinorUnits : amountMinorUnits;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${currency} ${negative ? "-" : ""}${whole.toLocaleString("en-US")}.${fraction}`;
}
