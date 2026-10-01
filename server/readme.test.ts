import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleReadmeAi } from './readme-ai';
import {
  emptyProfile,
  profileReadme,
  profileSections,
} from '../src/app/features/readme/profile-readme';
import { restoreDraft } from '../src/app/features/readme/readme-workspace';
import { generatedBanner } from '../src/app/features/readme/profile-presentation';
import type {
  ReadmeAiRequest,
  ReadmeAiResult,
} from '../src/app/features/readme/readme-ai-contract';

const payload: ReadmeAiRequest = {
  focus: 'Software engineering',
  tone: 'clear',
  facts: {
    headline: '',
    about: 'I build small tools in TypeScript and document what I learn.',
    skills: 'TypeScript',
    learning: '',
    collaboration: '',
    currentWork: '',
    highlights: '',
    projects: [
      {
        id: 1,
        name: 'Tool',
        description: 'A small tool for learning Git.',
        outcome: 'Wrote the tests.',
      },
    ],
  },
};
const request = (data: unknown = payload) =>
  new Request('https://example.com/api/readme-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
const suggestion = {
  field: 'about' as const,
  projectId: null,
  value: 'I build and document small TypeScript tools.',
  reason: 'More concise.',
};
const completion = (data: ReadmeAiResult) =>
  Response.json({
    status: 'completed',
    output: [{ content: [{ type: 'output_text', text: JSON.stringify(data) }] }],
  });
const forbidden: typeof fetch = async () => {
  throw new Error('Unexpected upstream call');
};

test('presentation exports safe linked badges and disclosure sections without broken navigation', () => {
  const draft = {
    ...structuredClone(emptyProfile),
    name: 'Sam & <team>',
    headline: 'Build & learn',
    theme: 'midnight',
    autoBanner: true,
    compact: true,
    layout: 'portfolio',
    badges: ['Python'],
    learning: 'Learning retrieval',
    skills: 'Python',
  };
  const banner = new URL(generatedBanner(draft)!);
  assert.equal(banner.searchParams.get('text'), 'Sam & <team>');
  assert.equal(banner.searchParams.get('color'), '101b36');
  const markdown = profileReadme(draft);
  assert.ok(markdown.includes('https://github.com/topics/python'));
  assert.ok(markdown.includes('<summary>Currently learning</summary>'));
  assert.equal(markdown.includes('](#currently-learning)'), false);
  assert.equal(markdown.includes('<team>'), false);
});

test('rejects unconfigured, invalid, oversized and throttled requests before upstream', async () => {
  for (const [req, deps, status] of [
    [request(), { fetcher: forbidden }, 503],
    [new Request('https://example.com'), { key: 'test', fetcher: forbidden }, 405],
    [request({ ...payload, apiKey: 'must-not-accept' }), { key: 'test', fetcher: forbidden }, 400],
    [
      request({ ...payload, facts: { ...payload.facts, about: '', projects: [] } }),
      { key: 'test', fetcher: forbidden },
      400,
    ],
    [request('x'.repeat(25000)), { key: 'test', fetcher: forbidden }, 413],
    [request(), { key: 'test', fetcher: forbidden, permitted: () => false }, 429],
  ] as const) {
    const result = await handleReadmeAi(req, deps);
    assert.equal(result.status, status);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
  }
});

test('uses bounded structured OpenAI output and keeps secret outside model input', async () => {
  let calls = 0;
  const response = await handleReadmeAi(request(), {
    key: 'test-server-secret',
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-server-secret');
      const body = JSON.parse(String(options?.body));
      assert.equal(body.model, 'gpt-5-nano');
      assert.equal(body.store, false);
      assert.equal(body.max_output_tokens, 2200);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.schema.additionalProperties, false);
      assert.equal(String(options?.body).includes('test-server-secret'), false);
      assert.deepEqual(JSON.parse(body.input), payload);
      return completion({ suggestions: [suggestion], note: 'Review every claim.' });
    },
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual((await response.json()).suggestions, [suggestion]);
});

test('drops unknown projects, mismatched fields and oversized headlines', async () => {
  const result = await handleReadmeAi(request(), {
    key: 'test',
    fetcher: async () =>
      completion({
        note: '',
        suggestions: [
          suggestion,
          { ...suggestion, field: 'project', projectId: 999 },
          { ...suggestion, field: 'headline', value: 'x'.repeat(181) },
          { ...suggestion, projectId: 1 },
          { ...suggestion, field: 'project', projectId: 1 },
        ],
      }),
  });
  assert.equal((await result.json()).suggestions.length, 2);
});

test('sanitizes provider errors without retries and rejects invalid completions', async () => {
  for (const status of [401, 429, 500]) {
    let calls = 0;
    const result = await handleReadmeAi(request(), {
      key: 'test',
      fetcher: async () => {
        calls++;
        return new Response('private upstream details', { status });
      },
    });
    assert.equal(result.status, status === 429 ? 429 : 502);
    assert.equal(calls, 1);
    assert.equal((await result.text()).includes('private upstream details'), false);
  }
  for (const data of [
    { status: 'incomplete' },
    { status: 'completed', output: [] },
    {
      status: 'completed',
      output: [{ content: [{ type: 'output_text', text: '{"suggestions":[]}' }] }],
    },
  ]) {
    const result = await handleReadmeAi(request(), {
      key: 'test',
      fetcher: async () => Response.json(data),
    });
    assert.equal(result.status, 502);
  }
});

test('preview sections and export share visibility, portfolio order and escaped content', () => {
  const draft = {
    ...structuredClone(emptyProfile),
    name: '<script>x</script>',
    about: 'About',
    skills: 'Git, Git',
    layout: 'portfolio',
    highlights: 'Made a tool\nDocumented it',
    projects: [
      {
        id: 1,
        name: 'Example',
        url: 'javascript:bad()',
        description: 'Hello',
        outcome: 'Added tests',
      },
    ],
  };
  const sections = profileSections(draft);
  assert.deepEqual(
    sections.map((s) => s.id),
    ['about', 'projects', 'highlights', 'skills'],
  );
  const markdown = profileReadme(draft);
  assert.ok(markdown.includes('&lt;script&gt;'));
  assert.ok(markdown.includes('[Selected projects](#selected-projects)'));
  assert.ok(markdown.includes('**Outcome:** Added tests'));
  assert.equal(markdown.includes('javascript:'), false);
  assert.equal(markdown.match(/- Git/g)?.length, 1);
  draft.hidden = ['projects'];
  assert.equal(
    profileSections(draft).some((s) => s.id === 'projects'),
    false,
  );
  assert.equal(profileReadme(draft).includes('Selected projects'), false);
});

test('backup validation recovers safely and normalizes duplicate project IDs', () => {
  for (const raw of [
    '{bad',
    '{"version":999}',
    JSON.stringify({ version: 1, draft: { ...emptyProfile, hidden: ['bad'] } }),
  ]) {
    assert.deepEqual(restoreDraft(raw), emptyProfile);
  }
  const project = { id: 7, name: 'Project', description: '', url: '' };
  const draft = restoreDraft(
    JSON.stringify({ version: 1, draft: { ...emptyProfile, projects: [project, project] } }),
  );
  assert.deepEqual(
    draft.projects.map((p) => p.id),
    [1, 2],
  );
});
