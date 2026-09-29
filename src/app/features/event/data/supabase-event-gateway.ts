import { Injectable } from '@angular/core';
import { fromFetch } from 'rxjs/fetch';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Observable,
  defer,
  from,
  map,
  switchMap,
  throwError,
  catchError,
  of,
  observeOn,
  asyncScheduler,
  distinctUntilChanged,
} from 'rxjs';
import { EVENT_CONFIG } from '../event-config';
import { statsSchema, welcomeSchema } from '../domain';
import type { EventStats, Registration, Submission, WelcomeEvent } from '../domain';
import { RegistrationError } from './event-gateway';
import type { EventGateway, LiveMessage } from './event-gateway';
import { attendeePageSchema } from './attendees';
import type { AttendeePage } from './attendees';

@Injectable()
export class SupabaseEventGateway implements EventGateway {
  readonly demo = false;
  importParticipants(rows: Registration[]): Observable<number> {
    return defer(() =>
      from(
        this.client().rpc('import_participants', {
          target_event: EVENT_CONFIG.eventId,
          participants: rows,
        }),
      ),
    ).pipe(
      map(({ data, error }) => {
        if (error)
          throw new Error(
            error.code === '42501'
              ? 'Sign in with an event operator account to import participants.'
              : 'Import failed. Check the CSV and try again. No rows were changed.',
          );
        return Number(data);
      }),
    );
  }
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

  resetAttendance(): Observable<number> {
    return defer(() =>
      from(
        this.client().rpc('reset_event_attendance', {
          target_event: EVENT_CONFIG.eventId,
          confirmed: true,
        }),
      ),
    ).pipe(
      map(({ data, error }) => {
        if (error)
          throw new Error(
            error.code === '42501'
              ? 'Your session has expired or this account does not have access.'
              : 'Could not reset attendance. Check your connection and that the latest database migration is applied.',
          );
        return Number(data);
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
        'Attendance is not connected yet. Please contact the event team.',
      );
    return (this.instance ??= createClient(
      EVENT_CONFIG.supabaseUrl,
      EVENT_CONFIG.supabasePublishableKey,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
    ));
  }

  register(submission: Submission): Observable<WelcomeEvent> {
    return defer(() => from(this.client().auth.getSession())).pipe(
      switchMap(({ data: { session }, error }) => {
        if (error || !session)
          throw new RegistrationError('unauthorized', 'Sign in to record attendance.');
        return from(
          this.client().functions.invoke('register', {
            body: submission,
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        );
      }),
      switchMap(({ data, error }) => {
        if (!error) return from(Promise.resolve(welcomeSchema.parse(data)));
        const response = error.context;
        if (response instanceof Response) {
          return from(response.json() as Promise<{ message?: string }>).pipe(
            switchMap((body) =>
              throwError(
                () =>
                  new RegistrationError(
                    response.status === 401 || response.status === 403
                      ? 'unauthorized'
                      : response.status === 409
                        ? 'duplicate'
                        : response.status === 429
                          ? 'rate-limit'
                          : 'invalid',
                    body.message ?? 'Attendance could not be confirmed. Please try again.',
                  ),
              ),
            ),
          );
        }
        return throwError(
          () =>
            new RegistrationError(
              'unavailable',
              'Could not connect. Your ID is still here; please try again.',
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
        const result = statsSchema.safeParse(data);
        if (!result.success)
          throw new RegistrationError(
            'unavailable',
            'The event database needs the latest analytics update. Your login is valid; contact the event administrator.',
          );
        return result.data;
      }),
    );
  }
  authorized(): Observable<boolean> {
    return defer(() => from(this.client().auth.getSession())).pipe(
      switchMap(({ data: { session }, error }) => {
        if (error) throw new Error('Could not restore your session. Please sign in again.');
        if (!session) return of(false);
        return from(
          this.client()
            .from('event_operators')
            .select('event_id')
            .eq('event_id', EVENT_CONFIG.eventId)
            .eq('user_id', session.user.id)
            .maybeSingle(),
        ).pipe(
          map(({ data, error }) => {
            if (error)
              throw new Error(
                'Could not verify event access. Check your connection and try again.',
              );
            return data !== null;
          }),
        );
      }),
    );
  }
  authorizationChanges(): Observable<boolean> {
    return new Observable<void>((subscriber) => {
      const {
        data: { subscription },
      } = this.client().auth.onAuthStateChange(() => subscriber.next());
      return () => subscription.unsubscribe();
    }).pipe(
      // Supabase holds its auth lock inside callbacks; query only after they return.
      observeOn(asyncScheduler),
      switchMap(() => this.authorized().pipe(catchError(() => of(false)))),
      distinctUntilChanged(),
    );
  }
  signIn(email: string, password: string): Observable<void> {
    return defer(() => from(this.client().auth.signInWithPassword({ email, password }))).pipe(
      map(({ error }) => {
        if (error)
          throw new Error(
            error.status === 400 || error.status === 422
              ? 'Could not sign in. Check your email and password.'
              : error.status === 429
                ? 'Too many sign-in attempts. Please wait a moment and try again.'
                : 'Could not reach the sign-in service. Check your connection and try again.',
          );
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
        .on('broadcast', { event: 'roster_changed' }, () => subscriber.next({ type: 'roster' }))
        .on('broadcast', { event: 'attendance_reset' }, () =>
          subscriber.next({ type: 'attendance-reset' }),
        )
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
