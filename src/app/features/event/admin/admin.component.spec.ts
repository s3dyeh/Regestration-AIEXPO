import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AdminComponent } from './admin.component';
import { EVENT_GATEWAY } from '../data/event-gateway';
import type { EventGateway } from '../data/event-gateway';

describe('Admin access', () => {
  let gateway: jasmine.SpyObj<EventGateway>;
  beforeEach(() => {
    gateway = jasmine.createSpyObj<EventGateway>('gateway', [
      'authorized',
      'signIn',
      'signOut',
      'attendees',
      'exportRegistrations',
    ]);
    gateway.authorized.and.returnValue(of(false));
    gateway.signIn.and.returnValue(of(undefined));
    gateway.signOut.and.returnValue(of(undefined));
    gateway.attendees.and.returnValue(of({ total: 0, rows: [] }));
    TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [provideRouter([]), { provide: EVENT_GATEWAY, useValue: gateway }],
    });
  });

  it('does not request or show registrations before authentication', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('table')).toBeNull();
    expect(host.textContent).toContain('Sign in with your event operator account');
    expect(gateway.attendees).not.toHaveBeenCalled();
  });

  it('denies authenticated accounts that are not event operators', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    for (const [field, value] of [
      ['email', 'person@example.com'],
      ['password', 'password'],
    ]) {
      const input = host.querySelector<HTMLInputElement>(`input[formControlName="${field}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(host.textContent).toContain('This account does not have access');
    expect(gateway.attendees).not.toHaveBeenCalled();
  });

  it('shows a retryable read failure without leaving contact data visible', () => {
    gateway.authorized.and.returnValue(of(true));
    gateway.attendees.and.returnValue(throwError(() => new Error('Session expired')));
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('Session expired');
    expect(host.textContent).toContain('Retry');
    expect(host.querySelectorAll('tbody .name').length).toBe(0);
  });

  it('sign-out hides contacts immediately and cancels an in-flight export', () => {
    gateway.authorized.and.returnValue(of(true));
    gateway.attendees.and.returnValue(
      of({
        total: 1,
        rows: [
          {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            fullName: 'Lina Omar',
            participantId: '001',
            isIeeeMember: false,
            role: 'Student',
            universityName: 'UJ',
            attendedAt: null,
            email: 'private@example.com',
            major: 'Engineering',
            gender: 'Female',
          },
        ],
      }),
    );
    const download = new Subject<Blob>();
    gateway.exportRegistrations.and.returnValue(download);
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('private@example.com');
    const button = (label: string) =>
      [...host.querySelectorAll('button')].find((el) => el.textContent?.includes(label))!;
    button('Export attendance').click();
    fixture.detectChanges();
    expect(download.observed).toBeTrue();
    button('Sign out').click();
    fixture.detectChanges();
    expect(download.observed).toBeFalse();
    expect(host.textContent).not.toContain('private@example.com');
    expect(gateway.signOut).toHaveBeenCalled();
  });
});
