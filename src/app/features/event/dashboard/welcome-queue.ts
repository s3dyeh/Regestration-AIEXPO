import type { WelcomeEvent } from '../domain';

export interface Greeting {
  names: string[];
  count: number;
}

/** Pure queue policy, independent of RxJS, animation libraries, and persistence. */
export class WelcomeQueue {
  private readonly seen = new Set<string>();
  private pending: WelcomeEvent[] = [];

  enqueue(event: WelcomeEvent, now = Date.now()): boolean {
    if (this.seen.has(event.id) || now - Date.parse(event.createdAt) > 30_000) return false;
    this.seen.add(event.id);
    if (this.seen.size > 2000) this.seen.delete(this.seen.values().next().value!);
    this.pending.push(event);
    return true;
  }

  next(now = Date.now()): Greeting | null {
    if (!this.pending.length) return null;
    const batch = this.pending.length > 5 || now - Date.parse(this.pending[0].createdAt) > 15_000;
    const events = this.pending.splice(0, batch ? this.pending.length : 1);
    return {
      count: events.length,
      names: events.flatMap((event) => (event.displayName ? [event.displayName] : [])),
    };
  }
  clear(): void {
    this.pending = [];
  }
}
