import { Injectable } from '@angular/core';
import { Observable, defer, from, of, throwError } from 'rxjs';
import { EVENT_CONFIG } from '../event-config';
import { displayName, submissionSchema, welcomeSchema } from '../domain';
import type { EventStats, Submission, WelcomeEvent } from '../domain';
import { RegistrationError } from './event-gateway';
import type { EventGateway, LiveMessage } from './event-gateway';

interface DemoRecord extends Submission {
  id: string;
  createdAt: string;
}

/** IndexedDB transactions enforce duplicate prevention across tabs. Demo data stays on this device. */
@Injectable()
export class DemoEventGateway implements EventGateway {
  readonly demo = true;
  private database?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    return (this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('funtime-demo-v1', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('registrations', { keyPath: 'requestId' });
        store.createIndex('email', ['eventId', 'registration.email'], { unique: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new RegistrationError(
            'unavailable',
            'Local storage is unavailable. Try another browser.',
          ),
        );
    }));
  }

  register(submission: Submission): Observable<WelcomeEvent> {
    const validation = submissionSchema.safeParse(submission);
    if (!validation.success)
      return throwError(() => new RegistrationError('invalid', validation.error.issues[0].message));
    submission = validation.data;
    return defer(() =>
      from(
        this.open().then(
          (db) =>
            new Promise<WelcomeEvent>((resolve, reject) => {
              const tx = db.transaction('registrations', 'readwrite');
              const store = tx.objectStore('registrations');
              const existing = store.get(submission.requestId);
              let saved: DemoRecord;
              let inserted = false;
              existing.onsuccess = () => {
                if (existing.result) {
                  saved = existing.result as DemoRecord;
                  if (
                    saved.eventId !== submission.eventId ||
                    JSON.stringify(saved.registration) !== JSON.stringify(submission.registration)
                  ) {
                    tx.abort();
                  }
                } else {
                  saved = {
                    ...submission,
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString(),
                  };
                  inserted = true;
                  store.add(saved);
                }
              };
              tx.oncomplete = () => {
                const event = {
                  id: saved.id,
                  displayName: displayName(saved.registration),
                  createdAt: saved.createdAt,
                };
                if (inserted) {
                  // A notification failure must never turn a committed registration into a failed save.
                  try {
                    const channel = new BroadcastChannel('funtime-demo');
                    channel.postMessage(event);
                    channel.close();
                  } catch {
                    /* Periodic statistics refresh recovers missed events. */
                  }
                }
                resolve(event);
              };
              tx.onabort = () =>
                reject(
                  new RegistrationError(
                    tx.error?.name === 'ConstraintError' ? 'duplicate' : 'invalid',
                    tx.error?.name === 'ConstraintError'
                      ? 'This email is already registered. See you at the event!'
                      : 'The submission could not be saved. Please try again.',
                  ),
                );
            }),
        ),
      ),
    );
  }

  statistics(): Observable<EventStats> {
    return defer(() =>
      from(
        this.open().then(
          (db) =>
            new Promise<EventStats>((resolve, reject) => {
              const request = db.transaction('registrations').objectStore('registrations').getAll();
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const rows = (request.result as DemoRecord[]).filter(
                  (row) => row.eventId === EVENT_CONFIG.eventId,
                );
                const countBy = (key: 'major' | 'gender') =>
                  [...new Set(rows.map((row) => row.registration[key]))].map((name) => ({
                    name,
                    count: rows.filter((row) => row.registration[key] === name).length,
                  }));
                const buckets = new Map<string, number>();
                rows.forEach((row) => {
                  const time = row.createdAt.slice(0, 13) + ':00:00Z';
                  buckets.set(time, (buckets.get(time) ?? 0) + 1);
                });
                resolve({
                  total: rows.length,
                  majors: countBy('major'),
                  genders: countBy('gender'),
                  timeline: [...buckets]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([time, count]) => ({ time, count })),
                  recentCount: rows.filter(
                    (row) => Date.parse(row.createdAt) >= Date.now() - 3_600_000,
                  ).length,
                  recent: rows
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, 6)
                    .map((row) => ({
                      id: row.id,
                      createdAt: row.createdAt,
                      displayName: displayName(row.registration),
                    })),
                });
              };
            }),
        ),
      ),
    );
  }

  watch(): Observable<LiveMessage> {
    return new Observable((subscriber) => {
      const channel = new BroadcastChannel('funtime-demo');
      subscriber.next({ type: 'connection', state: 'live' });
      channel.onmessage = ({ data }: MessageEvent<unknown>) => {
        const result = welcomeSchema.safeParse(data);
        if (result.success) subscriber.next({ type: 'welcome', event: result.data });
      };
      return () => channel.close();
    });
  }
  authorized(): Observable<boolean> {
    return of(true);
  }
  signIn(): Observable<void> {
    return throwError(() => new Error('Demo mode does not require sign in.'));
  }
  signOut(): Observable<void> {
    return of(undefined);
  }
}
