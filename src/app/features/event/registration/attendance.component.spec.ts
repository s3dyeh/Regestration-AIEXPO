import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AttendanceComponent } from './attendance.component';
import { EVENT_GATEWAY } from '../data/event-gateway';
import type { EventGateway } from '../data/event-gateway';

describe('Attendance authentication', () => {
  let gateway: jasmine.SpyObj<EventGateway>;
  beforeEach(() => {
    gateway = jasmine.createSpyObj<EventGateway>('gateway', [
      'authorized',
      'signIn',
      'signOut',
      'register',
    ]);
    gateway.authorized.and.returnValue(of(false));
    gateway.signIn.and.returnValue(of(undefined));
    gateway.signOut.and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [AttendanceComponent],
      providers: [{ provide: EVENT_GATEWAY, useValue: gateway }],
    });
  });
  it('hides the scanner and ID input until authorized', () => {
    const fixture = TestBed.createComponent(AttendanceComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('app-event-registration')).toBeNull();
    expect(host.textContent).toContain('Sign in with your event operator account');
    expect(gateway.register).not.toHaveBeenCalled();
  });
  it('rejects signed-in users without event membership', () => {
    const fixture = TestBed.createComponent(AttendanceComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    for (const [name, value] of [
      ['email', 'person@example.com'],
      ['password', 'password'],
    ]) {
      const input = host.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(host.textContent).toContain('This account does not have access');
    expect(host.querySelector('app-event-registration')).toBeNull();
  });
  it('allows an operator and destroys the check-in component on sign-out', () => {
    gateway.authorized.and.returnValue(of(true));
    const fixture = TestBed.createComponent(AttendanceComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('app-event-registration')).not.toBeNull();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Sign out'))!
      .click();
    fixture.detectChanges();
    expect(host.querySelector('app-event-registration')).toBeNull();
    expect(gateway.signOut).toHaveBeenCalled();
  });
});
