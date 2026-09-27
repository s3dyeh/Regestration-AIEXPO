import { Injectable } from '@angular/core';
import { fromFetch } from 'rxjs/fetch';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Observable, defer, from, map, switchMap, throwError, catchError } from 'rxjs';
import { EVENT_CONFIG } from '../event-config';
import { statsSchema, welcomeSchema } from '../domain';
import type { EventStats, Submission, WelcomeEvent } from '../domain';
import { RegistrationError } from './event-gateway';
import type { EventGateway, LiveMessage } from './event-gateway';
import { attendeePageSchema } from './attendees';
import type { AttendeePage } from './attendees';

@Injectable()
export class SupabaseEventGateway implements EventGateway {
  readonly demo = false;
  attendees(page: number, pageSize: number): Observable<AttendeePage> {
    return defer(() =>
      from(
        this.client().rpc('admin_registrations', {
          target_event: EVENT_CONFIG.eventId,
          page_number: page,
          page_size: pageSize,
        }),
      ),
    ).pipe(
      map(({ data, error }) => {
        if (error)
          throw new Error(
            error.code === '42501'
              ? 'Your session has expired or this account does not have access. Sign in again.'
              : 'Could not load registrations. Please try again.',
          );
        return attendeePageSchema.parse(data);
      }),
    );
  }

  exportRegistrations(): Observable<Blob> {
    // Unsubscribing (including sign-out/navigation) cancels the buffered download.
    return defer(() => from(this.client().auth.getSession())).pipe(
      switchMap(({ data: { session }, error }) => {
        if (error || !session) throw new Error('Please sign in again to export registrations.');
        return fromFetch(`${EVENT_CONFIG.supabaseUrl}/functions/v1/export-registrations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: EVENT_CONFIG.supabasePublishableKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ eventId: EVENT_CONFIG.eventId }),
          selector: (response) => {
            if (!response.ok)
              throw new Error(
                response.status === 401 || response.status === 403
                  ? 'Your session has expired or you do not have export access. Sign in again.'
                  : 'The export could not be completed. Please try again.',
              );
            return response.blob();
          },
        });
      }),
      map((blob) => {
        if (!blob.size || !blob.type.includes('spreadsheetml'))
          throw new Error('The export returned an invalid file. Please try again.');
        return blob;
      }),
    );
  }

  private instance?: SupabaseClient;
  private client(): SupabaseClient {
    if (!EVENT_CONFIG.supabaseUrl || !EVENT_CONFIG.supabasePublishableKey)
      throw new RegistrationError(
        'unavailable',
        'Registration is not connected yet. Please contact the event team.',
      );
    return (this.instance ??= createClient(
      EVENT_CONFIG.supabaseUrl,
      EVENT_CONFIG.supabasePublishableKey,
      { auth: { persistSession: false } },
    ));
  }

  register(submission: Submission): Observable<WelcomeEvent> {
    return defer(() => from(this.client().functions.invoke('register', { body: submission }))).pipe(
      switchMap(({ data, error }) => {
        if (!error) return from(Promise.resolve(welcomeSchema.parse(data)));
        const response = error.context;
        if (response instanceof Response) {
          return from(response.json() as Promise<{ message?: string }>).pipe(
            switchMap((body) =>
              throwError(
                () =>
                  new RegistrationError(
                    response.status === 409
                      ? 'duplicate'
                      : response.status === 429
                        ? 'rate-limit'
                        : 'invalid',
                    body.message ?? 'Registration could not be saved. Please try again.',
                  ),
              ),
            ),
          );
        }
        return throwError(
          () =>
            new RegistrationError(
              'unavailable',
              'Could not connect. Your details are still here; please try again.',
            ),
        );
      }),
    );
  }
  statistics(): Observable<EventStats> {
    return defer(() =>
      from(this.client().rpc('event_statistics', { target_event: EVENT_CONFIG.eventId })),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return statsSchema.parse(data);
      }),
    );
  }
  authorized(): Observable<boolean> {
    return this.statistics().pipe(
      map(() => true),
      catchError(() => from(Promise.resolve(false))),
    );
  }
  signIn(email: string, password: string): Observable<void> {
    return defer(() => from(this.client().auth.signInWithPassword({ email, password }))).pipe(
      map(({ error }) => {
        if (error) throw new Error('Could not sign in. Check your email and password.');
      }),
    );
  }
  signOut(): Observable<void> {
    return defer(() => from(this.client().auth.signOut())).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
    );
  }

  watch(): Observable<LiveMessage> {
    return new Observable((subscriber) => {
      const client = this.client();
      subscriber.next({ type: 'connection', state: 'connecting' });
      const channel = client
        .channel(`event:${EVENT_CONFIG.eventId}`, { config: { private: true } })
        .on('broadcast', { event: 'registration' }, ({ payload }) => {
          const result = welcomeSchema.safeParse(payload);
          if (result.success) subscriber.next({ type: 'welcome', event: result.data });
        })
        .subscribe((status) =>
          subscriber.next({
            type: 'connection',
            state: status === 'SUBSCRIBED' ? 'live' : 'offline',
          }),
        );
      return () => {
        void client.removeChannel(channel);
      };
    });
  }
}
