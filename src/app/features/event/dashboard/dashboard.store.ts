import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap, interval, merge, throttleTime } from 'rxjs';
import { EVENT_GATEWAY } from '../data/event-gateway';
import type { ConnectionState } from '../data/event-gateway';
import { emptyStats } from '../domain';
import { WelcomeQueue } from './welcome-queue';
import type { Greeting } from './welcome-queue';

@Injectable()
export class DashboardStore {
  private readonly gateway = inject(EVENT_GATEWAY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new Subject<void>();
  private readonly queue = new WelcomeQueue();
  private running = false;
  private cooldown?: ReturnType<typeof setTimeout>;
  readonly stats = signal(emptyStats());
  readonly connection = signal<ConnectionState>('connecting');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly greeting = signal<Greeting | null>(null);
  readonly welcomesEnabled = signal(true);
  readonly updatedAt = signal<Date | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.cooldown);
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    merge(this.refresh$, interval(30_000))
      .pipe(
        throttleTime(300, undefined, { leading: true, trailing: true }),
        switchMap(() =>
          this.gateway.statistics().pipe(
            catchError(() => {
              this.loading.set(false);
              this.error.set('Could not refresh. Showing the last available numbers.');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((stats) => {
        this.stats.set(stats);
        this.loading.set(false);
        this.error.set('');
        this.updatedAt.set(new Date());
      });
    this.gateway
      .watch()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (message) => {
          if (message.type === 'connection') {
            this.connection.set(message.state);
            if (message.state === 'live') {
              this.queue.clear();
              this.refresh();
            }
          } else {
            this.refresh();
            if (this.welcomesEnabled() && this.queue.enqueue(message.event)) this.presentNext();
          }
        },
        error: () => {
          this.connection.set('offline');
          this.error.set('The live connection is unavailable. Statistics refresh automatically.');
        },
      });
    this.refresh();
  }

  refresh(): void {
    this.refresh$.next();
  }
  setWelcomes(enabled: boolean): void {
    this.welcomesEnabled.set(enabled);
    if (!enabled) {
      this.queue.clear();
      this.greeting.set(null);
      clearTimeout(this.cooldown);
      this.cooldown = undefined;
    }
  }
  finishGreeting(): void {
    this.greeting.set(null);
    this.cooldown = setTimeout(() => {
      this.cooldown = undefined;
      this.presentNext();
    }, 5000);
  }
  private presentNext(): void {
    if (this.greeting() || this.cooldown) return;
    this.greeting.set(this.queue.next());
  }
}
