import { detectEvidence, githubUsername } from './github-analysis';

describe('GitHub evidence boundaries', () => {
  it('accepts a profile and rejects repository URLs and unrelated hosts', () => {
    expect(githubUsername(' https://github.com/student/ ')).toBe('student');
    expect(githubUsername('student')).toBe('student');
    expect(() => githubUsername('https://github.com/student/project')).toThrow();
    expect(() => githubUsername('https://github.com.example.org/student')).toThrow();
  });
  it('recognizes file evidence without treating arbitrary keywords as technologies', () => {
    const result = detectEvidence(
      [
        'docs/docker-notes.md',
        'README.md',
        'src/api.test.ts',
        '.github/workflows/ci.yml',
        'Dockerfile',
        'tsconfig.json',
      ],
      'JavaScript',
    );
    expect(result.skills).toEqual(['JavaScript', 'Docker', 'TypeScript']);
    expect(result.signals).toEqual(['README', 'Test files', 'CI configuration']);
    expect(result.paths).not.toContain('docs/docker-notes.md');
  });
  it('does not invent evidence for an empty tree', () => {
    expect(detectEvidence([], null)).toEqual({ skills: [], signals: [], paths: [] });
  });
});
