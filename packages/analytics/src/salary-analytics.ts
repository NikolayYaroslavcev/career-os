export interface SalaryEntry {
  readonly salaryMin: number | null;
  readonly salaryMax: number | null;
  readonly currency: string | null;
}

export interface AverageSalaryResult {
  readonly avgSalary: number | null;
  readonly currency: string | null;
}

/**
 * Mirrors the existing CareerMetrics precedent: refuses to average salaries across
 * mixed currencies (no FX conversion in scope) rather than producing a misleading number.
 */
export function computeAverageSalary(entries: readonly SalaryEntry[]): AverageSalaryResult {
  const withSalary = entries.filter((e) => e.salaryMin !== null || e.salaryMax !== null);
  if (withSalary.length === 0) return { avgSalary: null, currency: null };

  const currencies = new Set(withSalary.map((e) => e.currency).filter((c): c is string => c !== null));
  if (currencies.size !== 1) return { avgSalary: null, currency: null };

  const midpoints = withSalary.map((e) => {
    const min = e.salaryMin ?? (e.salaryMax as number);
    const max = e.salaryMax ?? (e.salaryMin as number);
    return (min + max) / 2;
  });

  const avgSalary = Math.round(midpoints.reduce((sum, v) => sum + v, 0) / midpoints.length);
  const [currency] = currencies;
  return { avgSalary, currency: currency ?? null };
}
