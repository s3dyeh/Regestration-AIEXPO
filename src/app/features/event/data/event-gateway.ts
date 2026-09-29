import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { EventStats, Registration, Submission, WelcomeEvent } from '../domain';
import type { AttendeePage } from './attendees';

export type ConnectionState = 'connecting' | 'live' | 'offline';
export type LiveMessage =
  | { type: 'connection'; state: ConnectionState }
  | { type: 'welcome'; event: WelcomeEvent }
  | { type: 'roster' }
  | { type: 'attendance-reset' };

export class RegistrationError extends Error {
  constructor(
    readonly code: 'unauthorized' | 'duplicate' | 'unavailable' | 'rate-limit' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

export interface EventGateway {
  readonly demo: boolean;
  importParticipants(rows: Registration[]): Observable<number>;
  register(submission: Submission): Observable<WelcomeEvent>;
  statistics(): Observable<EventStats>;
  watch(): Observable<LiveMessage>;
  authorized(): Observable<boolean>;
  authorizationChanges?(): Observable<boolean>;
  signIn(email: string, password: string): Observable<void>;
  signOut(): Observable<void>;
  attendees(page: number, pageSize: number): Observable<AttendeePage>;
  exportRegistrations(): Observable<Blob>;
  resetAttendance(): Observable<number>;
}
export const EVENT_GATEWAY = new InjectionToken<EventGateway>('EventGateway');
