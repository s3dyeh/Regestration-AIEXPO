import type { FormGroupDirective } from '@angular/forms';
import { participantId } from '../data/participant-id';
import { registrationSchema } from '../domain';
import { majorCategory } from '../data/major-category';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import type { PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { finalize, Subject, switchMap, takeUntil } from 'rxjs';
import { EVENT_GATEWAY } from '../data/event-gateway';
import type { Attendee } from '../data/attendees';

@Component({
  selector: 'app-event-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    RouterLink,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  protected readonly gateway = inject(EVENT_GATEWAY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionEnded = new Subject<void>();
  protected readonly authorized = signal(false);
  protected readonly checking = signal(true);
  protected readonly pending = signal(false);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly resetting = signal(false);
  protected readonly error = signal('');
  protected readonly exportError = signal('');
  protected readonly notice = signal('');
  protected readonly rows = signal<Attendee[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {
    (this.gateway.authorizationChanges?.() ?? this.gateway.authorized())
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (allowed) => {
          this.checking.set(false);
          this.authorized.set(allowed);
          if (allowed) this.load();
          else {
            this.sessionEnded.next();
            this.participantForm.reset();
            this.registrationError.set('');
            this.registrationNotice.set('');
            this.rows.set([]);
            this.total.set(0);
          }
        },
        error: () => this.checking.set(false),
      });
  }

  protected readonly saving = signal(false);
  protected readonly registrationError = signal('');
  protected readonly registrationNotice = signal('');
  protected readonly participantForm = inject(FormBuilder).nonNullable.group({
    participantId: ['', [Validators.required, Validators.maxLength(100)]],
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: ['', [Validators.required, Validators.maxLength(100)]],
    universityName: ['', Validators.maxLength(200)],
    major: ['', Validators.maxLength(200)],
    isIeeeMember: false,
  });

  protected saveParticipant(directive: FormGroupDirective): void {
    if (this.saving() || !this.authorized()) return;
    this.participantForm.markAllAsTouched();
    this.registrationError.set('');
    this.registrationNotice.set('');
    if (this.participantForm.invalid) return;
    const raw = this.participantForm.getRawValue();
    const clean = (value: string) =>
      value
        .normalize('NFKC')
        .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const result = registrationSchema.safeParse({
      ...raw,
      participantId: participantId(clean(raw.participantId)),
      fullName: clean(raw.fullName),
      email: clean(raw.email),
      role: clean(raw.role),
      universityName: clean(raw.universityName) || 'Not Provided',
      major: clean(raw.major) || 'Not Provided',
      majorCategory: majorCategory(clean(raw.major)),
      gender: 'Not Provided',
    });
    if (!result.success) {
      this.registrationError.set(
        'Please check ' +
          result.error.issues[0].path.join('.') +
          ': ' +
          result.error.issues[0].message,
      );
      return;
    }
    this.saving.set(true);
    this.gateway
      .importParticipants([result.data])
      .pipe(
        takeUntil(this.sessionEnded),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (count) => {
          if (!count) {
            this.registrationError.set(
              'This participant ID already exists. No details or attendance were changed.',
            );
            return;
          }
          this.registrationNotice.set(
            `Participant ${result.data.participantId} registered. Use this ID at check-in.`,
          );
          directive.resetForm();
        },
        error: () =>
          this.registrationError.set(
            'Could not register this participant. Check your connection and try again. Existing IDs will not be duplicated.',
          ),
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
        next: (allowed) => {
          this.form.controls.password.reset();
          this.authorized.set(allowed);
          if (allowed) this.load(0);
          else this.error.set('This account does not have access to this event.');
        },
        error: (error: unknown) =>
          this.error.set(this.message(error, 'Sign in failed. Please try again.')),
      });
  }

  protected load(page = this.pageIndex(), size = this.pageSize()): void {
    if (!this.authorized() || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.rows.set([]);
    this.gateway
      .attendees(page, size)
      .pipe(
        takeUntil(this.sessionEnded),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.rows.set(result.rows);
          this.total.set(result.total);
          this.pageIndex.set(page);
          this.pageSize.set(size);
        },
        error: (error: unknown) =>
          this.error.set(this.message(error, 'Could not load attendance. Please try again.')),
      });
  }

  protected changePage(event: PageEvent): void {
    this.load(event.pageIndex, event.pageSize);
  }

  protected resetAttendance(): void {
    if (!this.authorized() || this.resetting() || this.loading() || this.exporting()) return;
    if (
      !window.confirm(
        'Reset ALL attendance for this event?\n\nThis clears every check-in and scan history, including records on other pages. Participant registrations will be kept. The live dashboard will reset.\n\nThis cannot be undone. Choose OK to reset attendance, or Cancel to keep it.',
      )
    )
      return;
    this.resetting.set(true);
    this.error.set('');
    this.notice.set('');
    this.gateway
      .resetAttendance()
      .pipe(
        takeUntil(this.sessionEnded),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.resetting.set(false)),
      )
      .subscribe({
        next: (count) => {
          this.notice.set(
            `Attendance reset: ${count} check-ins cleared. Participant registrations were kept.`,
          );
          this.load(0);
        },
        error: (error: unknown) =>
          this.error.set(
            this.message(error, 'Could not reset attendance. Please refresh and try again.'),
          ),
      });
  }

  protected export(): void {
    if (this.exporting() || !this.authorized()) return;
    this.exporting.set(true);
    this.exportError.set('');
    this.notice.set('');
    this.gateway
      .exportRegistrations()
      .pipe(
        takeUntil(this.sessionEnded),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.exporting.set(false)),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `ai-expo-attendance-${new Date().toISOString().slice(0, 10)}.xlsx`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.notice.set('Your Excel download is ready.');
        },
        error: (error: unknown) =>
          this.exportError.set(
            this.message(error, 'Could not complete the export. Please try again.'),
          ),
      });
  }

  protected signOut(): void {
    this.sessionEnded.next();
    this.authorized.set(false);
    this.rows.set([]);
    this.total.set(0);
    this.error.set('');
    this.exportError.set('');
    this.notice.set('');
    this.gateway
      .signOut()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () =>
          this.error.set(
            'Could not end the server session. Check your connection and retry signing out.',
          ),
      });
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
