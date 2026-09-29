import groups from './major-categories.json';
const key = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
const categories = new Map(
  Object.entries(groups).flatMap(([category, majors]) =>
    majors.map((major) => [key(major), category] as const),
  ),
);

/** Known cleaned major labels only; ambiguous or unfamiliar values stay unclassified. */
export function majorCategory(major: string): string {
  const normalized = key(major);
  if (!normalized || normalized === 'not provided') return 'Not Provided';
  return categories.get(normalized) ?? 'Unclassified';
}
