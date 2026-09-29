import { rankedBreakdown, representedCount } from './analytics';

describe('Audience analytics', () => {
  it('preserves totals when showing the leading groups and remainder', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      name: `University ${index}`,
      count: index + 1,
    }));
    const displayed = rankedBreakdown(rows);
    expect(displayed.length).toBe(5);
    expect(displayed[0]).toEqual({ name: 'University 9', count: 10 });
    expect(displayed.at(-1)).toEqual({ name: 'Remaining 6 groups', count: 21 });
    expect(displayed.reduce((sum, row) => sum + row.count, 0)).toBe(55);
    expect(rows[0].name).toBe('University 0');
  });
  it('does not count missing or unspecified universities as institutions', () => {
    expect(
      representedCount([
        { name: 'Not Provided', count: 4 },
        { name: 'Other', count: 1 },
        { name: 'UJ', count: 2 },
      ]),
    ).toBe(1);
    expect(representedCount([])).toBe(0);
  });
});
