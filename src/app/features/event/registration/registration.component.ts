import { participantId } from '../data/participant-id';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { EVENT_GATEWAY, RegistrationError } from '../data/event-gateway';
import { EVENT_CONFIG } from '../event-config';
import type { WelcomeEvent } from '../domain';

@Component({
  selector: 'app-event-registration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.scss',
  host: { '(document:keydown)': 'onShortcut($event)' },
})
export class RegistrationComponent {
  readonly accessDenied = output<void>();
  readonly checkedIn = output<void>();
  private readonly gateway = inject(EVENT_GATEWAY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly idInput = viewChild<ElementRef<HTMLInputElement>>('idInput');
  private requestId = crypto.randomUUID();
  private lastId = '';
  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal<WelcomeEvent | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    participantId: ['', [Validators.required, Validators.maxLength(100)]],
  });
  constructor() {
    afterNextRender(() => this.idInput()?.nativeElement.focus());
  }
  protected onShortcut(event: KeyboardEvent): void {
    if (
      !this.success() ||
      this.pending() ||
      event.key.toLowerCase() !== 'r' ||
      event.repeat ||
      event.isComposing ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))
    )
      return;
    event.preventDefault();
    this.next();
  }
  protected next(): void {
    this.success.set(null);
    this.error.set('');
    this.form.reset();
    this.lastId = '';
    this.requestId = crypto.randomUUID();
    setTimeout(() => this.idInput()?.nativeElement.focus());
  }
  protected submit(): void {
    if (this.pending()) return;
    const id = participantId(this.form.controls.participantId.value);
    if (!id || id.length > 100) {
      this.error.set('Enter a participant ID (up to 100 characters).');
      return;
    }
    if (id !== this.lastId) {
      this.requestId = crypto.randomUUID();
      this.lastId = id;
    }
    this.pending.set(true);
    this.error.set('');
    this.gateway
      .register({ eventId: EVENT_CONFIG.eventId, requestId: this.requestId, participantId: id })
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (event) => {
          this.success.set(event);
          this.checkedIn.emit();
        },
        error: (error: unknown) => {
          if (error instanceof RegistrationError && error.code === 'unauthorized')
            this.accessDenied.emit();
          this.error.set(error instanceof Error ? error.message : 'Check-in failed. Please retry.');
        },
      });
  }
}
