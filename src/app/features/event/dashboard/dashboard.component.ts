import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize, switchMap } from 'rxjs';
import { EVENT_GATEWAY } from '../data/event-gateway';
import { LiveDashboardComponent } from './live-dashboard.component';

@Component({
  selector: 'app-event-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, LiveDashboardComponent],
  template: `
    @if (checking()) {
      <p class="auth-panel" role="status">Opening the live room…</p>
    } @else if (authorized()) {
      <app-live-dashboard (signedOut)="authorized.set(false)" />
    } @else {
      <main class="auth-panel">
        <span class="material-icons" aria-hidden="true">tv</span>
        <h1>The live room.</h1>
        <p>Sign in with your event operator account to open the display.</p>
        <form [formGroup]="form" (ngSubmit)="signIn()">
          <mat-form-field appearance="outline"
            ><mat-label>Operator email</mat-label
            ><input
              matInput
              type="email"
              formControlName="email"
              autocomplete="username"
            /><mat-error>Enter your operator email.</mat-error></mat-form-field
          >
          <mat-form-field appearance="outline"
            ><mat-label>Password</mat-label
            ><input
              matInput
              type="password"
              formControlName="password"
              autocomplete="current-password"
            /><mat-error>Enter your password.</mat-error></mat-form-field
          >
          @if (error()) {
            <p role="alert">{{ error() }}</p>
          }
          <button type="submit" [disabled]="pending()">
            {{ pending() ? 'Opening…' : 'Open live room' }}
          </button>
        </form>
      </main>
    }
  `,
  styles:
    '.auth-panel{max-width:420px;margin:80px auto;padding:32px;background:#17131f;border:1px solid #ffffff15;border-radius:16px}h1{font-size:40px;letter-spacing:-2px}p{color:#aca2ba;line-height:1.8}mat-form-field{width:100%}button{border:0;border-radius:6px;background:#7a3cff;color:white;width:100%;padding:16px;cursor:pointer}button:disabled{opacity:.6}',
})
export class DashboardComponent {
  private readonly gateway = inject(EVENT_GATEWAY);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly authorized = signal(false);
  protected readonly checking = signal(true);
  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  constructor() {
    this.gateway
      .authorized()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (authorized) => {
          this.authorized.set(authorized);
          this.checking.set(false);
        },
        error: () => this.checking.set(false),
      });
  }
  protected signIn(): void {
    if (this.pending()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.pending.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.gateway
      .signIn(email.trim(), password)
      .pipe(
        switchMap(() => this.gateway.authorized()),
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (authorized) => {
          this.authorized.set(authorized);
          this.form.controls.password.reset();
          if (!authorized) this.error.set('This account does not have access to this event.');
        },
        error: (error: unknown) =>
          this.error.set(
            error instanceof Error ? error.message : 'Sign in failed. Please try again.',
          ),
      });
  }
}
