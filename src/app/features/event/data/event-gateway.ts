import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { EventStats, Submission, WelcomeEvent } from '../domain';

export type ConnectionState = 'connecting' | 'live' | 'offline';
export type LiveMessage =
  { type: 'connection'; state: ConnectionState } | { type: 'welcome'; event: WelcomeEvent };

export class RegistrationError extends Error {
  constructor(
    readonly code: 'duplicate' | 'unavailable' | 'rate-limit' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

export interface EventGateway {
  readonly demo: boolean;
  register(submission: Submission): Observable<WelcomeEvent>;
  statistics(): Observable<EventStats>;
  watch(): Observable<LiveMessage>;
  authorized(): Observable<boolean>;
  signIn(email: string, password: string): Observable<void>;
  signOut(): Observable<void>;
}
export const EVENT_GATEWAY = new InjectionToken<EventGateway>('EventGateway');
