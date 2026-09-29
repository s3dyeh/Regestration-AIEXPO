import { Injectable } from '@angular/core';
import { audienceStatistics } from './audience-statistics';
import { Observable, defer, from, map, of } from 'rxjs';
import { EVENT_CONFIG } from '../event-config';
import { registrationSchema, submissionSchema, welcomeSchema } from '../domain';
import type { EventStats, Registration, Submission, WelcomeEvent } from '../domain';
import type { EventGateway, LiveMessage } from './event-gateway';
import type { Attendee, AttendeePage } from './attendees';
import {
  exportColumns,
  exportValues,
} from '../../../../../supabase/functions/_shared/export-columns';

@Injectable()
export class DemoEventGateway implements EventGateway {
  readonly demo = true;
  private database?: Promise<IDBDatabase>;
  private open(): Promise<IDBDatabase> {
    return (this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('ai-expo-attendance-v1', 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('participants')) {
          request.result.createObjectStore('participants', { keyPath: 'participantId' });
          request.result.createObjectStore('scans', { keyPath: 'id' });
        } else {
          const cursor = request.transaction!.objectStore('participants').openCursor();
          cursor.onsuccess = () => {
            const record = cursor.result;
            if (!record) return;
            const value = record.value;
            delete value.phone;
            record.update(value);
            record.continue();
          };
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Local storage unavailable.'));
    }));
  }
  private all(): Promise<Attendee[]> {
    return this.open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const request = db.transaction('participants').objectStore('participants').getAll();
          request.onsuccess = () => resolve(request.result as Attendee[]);
          request.onerror = () => reject(request.error);
        }),
    );
  }
  importParticipants(rows: Registration[]): Observable<number> {
    return defer(() =>
      from(
        this.open().then(
          (db) =>
            new Promise<number>((resolve, reject) => {
              const parsed = rows.map((row) => registrationSchema.parse(row));
              if (
                !parsed.length ||
                parsed.length > 10000 ||
                new Set(parsed.map((row) => row.participantId)).size !== parsed.length
              )
                throw new Error('Invalid import or duplicate IDs.');
              let inserted = 0;
              const tx = db.transaction('participants', 'readwrite');
              const store = tx.objectStore('participants');
              for (const row of parsed) {
                const request = store.get(row.participantId);
                request.onsuccess = () => {
                  const old = request.result as Attendee | undefined;
                  if (old) return;
                  inserted++;
                  store.add({
                    ...row,
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString(),
                    attendedAt: null,
                  });
                };
              }
              tx.oncomplete = () => {
                if (inserted) {
                  try {
                    const channel = new BroadcastChannel('funtime-demo');
                    channel.postMessage({ type: 'roster' });
                    channel.close();
                  } catch {
                    /* Polling refreshes the roster. */
                  }
                }
                resolve(inserted);
              };
              tx.onabort = () => reject(new Error('Import failed. No rows were changed.'));
            }),
        ),
      ),
    );
  }
  register(input: Submission): Observable<WelcomeEvent> {
    return defer(() =>
      from(
        this.open().then(
          (db) =>
            new Promise<WelcomeEvent>((resolve, reject) => {
              const submission = submissionSchema.parse(input);
              if (submission.eventId !== EVENT_CONFIG.eventId) throw new Error('Unknown event.');
              const tx = db.transaction(['participants', 'scans'], 'readwrite');
              const participants = tx.objectStore('participants');
              const scans = tx.objectStore('scans');
              let event: WelcomeEvent;
              let fresh = false;
              let failure = 'Check-in failed.';
              const prior = scans.get(submission.requestId);
              prior.onsuccess = () => {
                if (prior.result) {
                  if (prior.result.participantId !== submission.participantId) {
                    failure = 'Request conflict.';
                    tx.abort();
                    return;
                  }
                  event = welcomeSchema.parse(prior.result);
                  return;
                }
                const request = participants.get(submission.participantId);
                request.onsuccess = () => {
                  const row = request.result as Attendee | undefined;
                  if (!row) {
                    failure =
                      'ID not found. Please ask the event team to check the participant list.';
                    tx.abort();
                    return;
                  }
                  const now = new Date().toISOString();
                  event = {
                    id: submission.requestId,
                    displayName: row.fullName,
                    createdAt: now,
                    alreadyAttended: !!row.attendedAt,
                  };
                  participants.put({ ...row, attendedAt: row.attendedAt ?? now });
                  scans.add({ ...event, participantId: submission.participantId });
                  fresh = true;
                };
              };
              tx.oncomplete = () => {
                if (fresh) {
                  try {
                    const channel = new BroadcastChannel('funtime-demo');
                    channel.postMessage(event);
                    channel.close();
                  } catch {
                    /* Saved; polling recovers statistics. */
                  }
                }
                resolve(event);
              };
              tx.onabort = () => reject(new Error(failure));
            }),
        ),
      ),
    );
  }
  attendees(page: number, pageSize: number): Observable<AttendeePage> {
    return defer(() => from(this.all())).pipe(
      map((records) => records.filter((row) => row.attendedAt !== null)),
      map((records) => ({
        total: records.length,
        rows: records
          .sort((a, b) => b.attendedAt!.localeCompare(a.attendedAt!) || b.id.localeCompare(a.id))
          .slice(page * pageSize, (page + 1) * pageSize),
      })),
    );
  }
  statistics(): Observable<EventStats> {
    return defer(() => from(this.all())).pipe(map((all) => audienceStatistics(all)));
  }
  resetAttendance(): Observable<number> {
    return defer(() =>
      from(
        this.open().then(
          (db) =>
            new Promise<number>((resolve, reject) => {
              const tx = db.transaction(['participants', 'scans'], 'readwrite');
              let count = 0;
              const cursor = tx.objectStore('participants').openCursor();
              cursor.onsuccess = () => {
                const row = cursor.result;
                if (!row) return;
                if (row.value.attendedAt) {
                  count++;
                  row.update({ ...row.value, attendedAt: null });
                }
                row.continue();
              };
              tx.objectStore('scans').clear();
              tx.oncomplete = () => {
                try {
                  const channel = new BroadcastChannel('funtime-demo');
                  channel.postMessage({ type: 'attendance-reset' });
                  channel.close();
                } catch {
                  /* Polling refreshes attendance. */
                }
                resolve(count);
              };
              tx.onabort = () =>
                reject(new Error('Attendance reset failed. No records were changed.'));
            }),
        ),
      ),
    );
  }
  exportRegistrations(): Observable<Blob> {
    return defer(() =>
      from(
        Promise.all([import('exceljs'), this.all()])
          .then(([{ default: ExcelJS }, records]) => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Attendance');
            sheet.columns = exportColumns;
            sheet.getColumn('attendedAt').numFmt = 'yyyy-mm-dd hh:mm:ss';
            for (const row of records.filter((row) => row.attendedAt !== null))
              sheet.addRow(
                exportValues({
                  ...row,
                  eventId: EVENT_CONFIG.eventId,
                  requestId: row.id,
                  showName: true,
                }),
              );
            return workbook.xlsx.writeBuffer();
          })
          .then(
            (bytes) =>
              new Blob([new Uint8Array(bytes)], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
        if (data && typeof data === 'object' && 'type' in data && data.type === 'roster') {
          subscriber.next({ type: 'roster' });
          return;
        }
        if (
          data &&
          typeof data === 'object' &&
          'type' in data &&
          data.type === 'attendance-reset'
        ) {
          subscriber.next({ type: 'attendance-reset' });
          return;
        }
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
    return of(undefined);
  }
  signOut(): Observable<void> {
    return of(undefined);
  }
}
