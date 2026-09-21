import { WelcomeQueue } from './welcome-queue';

describe('WelcomeQueue', () => {
  const event = (offset = 0) => ({
    id: crypto.randomUUID(),
    displayName: 'Lina',
    createdAt: new Date(Date.now() - offset).toISOString(),
  });
  it('deduplicates events and skips historical greetings', () => {
    const queue = new WelcomeQueue();
    const welcome = event();
    expect(queue.enqueue(welcome)).toBeTrue();
    expect(queue.enqueue(welcome)).toBeFalse();
    expect(queue.enqueue(event(60_000))).toBeFalse();
    expect(queue.next()?.count).toBe(1);
    expect(queue.next()).toBeNull();
  });
  it('batches busy periods and respects anonymous participants', () => {
    const queue = new WelcomeQueue();
    for (let index = 0; index < 20; index++)
      queue.enqueue({ ...event(), displayName: index ? 'Lina' : null });
    const next = queue.next();
    expect(next?.count).toBe(20);
    expect(next?.names.length).toBe(19);
    expect(queue.next()).toBeNull();
  });
  it('clears waiting welcomes on reconnect but retains deduplication', () => {
    const queue = new WelcomeQueue();
    const welcome = event();
    queue.enqueue(welcome);
    queue.clear();
    expect(queue.next()).toBeNull();
    expect(queue.enqueue(welcome)).toBeFalse();
  });
});
