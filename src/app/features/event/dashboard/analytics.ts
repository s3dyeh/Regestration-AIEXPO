export interface BreakdownRow {
  name: string;
  count: number;
}

export function representedCount(rows: BreakdownRow[]): number {
  return rows.filter(
    (row) =>
      !['not provided', 'other', 'others', 'unknown', 'n/a'].includes(
        row.name.trim().toLowerCase(),
      ) && row.count > 0,
  ).length;
}

/** Keep the complete denominator while fitting the stage display. */
export function rankedBreakdown(rows: BreakdownRow[]): BreakdownRow[] {
  const ranked = [...rows].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (ranked.length <= 5) return ranked;
  return [
    ...ranked.slice(0, 4),
    {
      name: `Remaining ${ranked.length - 4} groups`,
      count: ranked.slice(4).reduce((sum, row) => sum + row.count, 0),
    },
  ];
}
