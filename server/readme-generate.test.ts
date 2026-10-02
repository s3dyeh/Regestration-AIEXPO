import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleReadmeAi } from './readme-ai';
const request = (includeProjects = true) =>
  new Request('https://example.com/api/readme-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'generate',
      includeProjects,
      name: 'Sam',
      username: 'sam',
      focus: 'Software engineering',
    }),
  });
const profile = {
  login: 'sam',
  bio: 'I build tools.',
  location: 'Amman',
  blog: 'https://example.com',
};
const repository = {
  id: 10,
  name: 'demo',
  description: 'A learning app',
  language: 'TypeScript',
  topics: ['angular'],
  fork: false,
  archived: false,
  private: false,
};
const content = {
  headline: 'Building tools',
  about: 'I build tools for learning.',
  currentWork: 'Exploring a learning app.',
  highlights: '',
  learning: 'Interested in testing.',
  collaboration: 'Interested in learning together.',
  skills: ['TypeScript', 'Angular', 'Python'],
  projects: [
    { id: 10, description: 'A learning app built with Angular.', outcome: '' },
    { id: 999, description: 'Fake project', outcome: '' },
  ],
};
const completion = () =>
  Response.json({
    status: 'completed',
    output: [{ content: [{ type: 'output_text', text: JSON.stringify(content) }] }],
  });

test('generation uses GitHub evidence, excludes profile/fork/private repos, filters invented badges/projects', async () => {
  const urls: string[] = [];
  const result = await handleReadmeAi(request(), {
    key: 'openai-secret',
    githubToken: 'github-secret',
    fetcher: async (url, init) => {
      const path = String(url);
      urls.push(path);
      if (path.includes('api.openai.com')) {
        const body = JSON.parse(String(init?.body));
        const input = JSON.parse(body.input);
        assert.deepEqual(input.observedTools.sort(), ['Angular', 'TypeScript']);
        assert.equal(input.repositories.length, 1);
        assert.equal(String(init?.body).includes('github-secret'), false);
        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer openai-secret');
        return completion();
      }
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer github-secret');
      if (path.endsWith('/users/sam')) return Response.json(profile);
      if (path.includes('/users/sam/repos?'))
        return Response.json([
          repository,
          { ...repository, id: 11, name: 'Sam' },
          { ...repository, id: 12, name: 'fork', fork: true },
          { ...repository, id: 13, private: true },
        ]);
      if (path.endsWith('/languages')) return Response.json({ TypeScript: 2000 });
      if (path.endsWith('/readme'))
        return Response.json({
          encoding: 'base64',
          content: Buffer.from('Angular learning app').toString('base64'),
        });
      throw new Error('Unexpected URL');
    },
  });
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.deepEqual(data.badges, ['TypeScript', 'Angular']);
  assert.equal(data.content.projects.length, 1);
  assert.equal(data.repositories[0].url, 'https://github.com/sam/demo');
  assert.equal(urls.length, 5);
});

test('missing or rate-limited GitHub accounts stop before paid AI calls', async () => {
  for (const [status, expected] of [
    [404, 404],
    [403, 429],
    [429, 429],
  ]) {
    let calls = 0;
    const result = await handleReadmeAi(request(), {
      key: 'test',
      fetcher: async () => {
        calls++;
        return new Response('', { status });
      },
    });
    assert.equal(result.status, expected);
    assert.equal(calls, 1);
  }
});

test('empty accounts get a modest draft with no invented projects or badges', async () => {
  const result = await handleReadmeAi(request(), {
    key: 'test',
    fetcher: async (url) => {
      if (String(url).includes('api.openai.com')) return completion();
      return Response.json(String(url).endsWith('/users/sam') ? profile : []);
    },
  });
  const data = await result.json();
  assert.equal(result.status, 200);
  assert.deepEqual(data.badges, []);
  assert.deepEqual(data.content.projects, []);
  assert.match(data.note, /No eligible public projects/);
});

test('supplementary rate limits stop GitHub reads and disclose partial evidence', async () => {
  let calls = 0;
  const result = await handleReadmeAi(request(), {
    key: 'test',
    fetcher: async (url) => {
      const path = String(url);
      if (path.includes('api.openai.com')) return completion();
      calls++;
      if (path.endsWith('/users/sam')) return Response.json(profile);
      if (path.includes('/repos?')) return Response.json([repository]);
      return new Response('', { status: 403 });
    },
  });
  assert.equal(calls, 3);
  assert.match((await result.json()).note, /evidence was unavailable/);
});

test('project opt-out is enforced while README evidence still informs the personal brief', async () => {
  const readme = 'Angular project for teaching accessible interfaces. '.repeat(90);
  const result = await handleReadmeAi(request(false), {
    key: 'test',
    fetcher: async (url, init) => {
      const path = String(url);
      if (path.includes('api.openai.com')) {
        const body = JSON.parse(String(init?.body));
        const input = JSON.parse(body.input);
        assert.equal(input.includeProjects, false);
        assert.equal(input.repositories[0].readme, readme);
        assert.match(body.instructions, /emojis/);
        return completion();
      }
      if (path.endsWith('/users/sam')) return Response.json(profile);
      if (path.includes('/repos?')) return Response.json([repository]);
      if (path.endsWith('/languages')) return Response.json({ TypeScript: 100 });
      return Response.json({ encoding: 'base64', content: Buffer.from(readme).toString('base64') });
    },
  });
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.deepEqual(data.content.projects, []);
  assert.ok(data.content.about);
  assert.deepEqual(data.badges, ['TypeScript', 'Angular']);
});
