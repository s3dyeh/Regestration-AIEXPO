import { NeuralArtComponent } from '../ui/neural-art.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { ValidatorFn } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { EVENT_GATEWAY } from '../data/event-gateway';
import { EVENT_CONFIG } from '../event-config';
import { GENDERS, MAJORS, registrationSchema } from '../domain';
import type { Registration } from '../domain';
import { RegistrationReceiptService } from '../data/registration-receipt.service';
import { RevealDirective } from '../ui/reveal.directive';

function fieldValidator(field: keyof Registration): ValidatorFn {
  return (control) => {
    const result = registrationSchema.shape[field].safeParse(control.value);
    return result.success ? null : { validation: result.error.issues[0]?.message };
  };
}

@Component({
  selector: 'app-event-registration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NeuralArtComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    RevealDirective,
  ],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.scss',
})
export class RegistrationComponent {
  protected readonly receipts = inject(RegistrationReceiptService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly gateway = inject(EVENT_GATEWAY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly builder = inject(FormBuilder).nonNullable;
  protected readonly majors = MAJORS;
  protected readonly genders = GENDERS;
  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal<string | null>(this.receipts.receipt()?.firstName ?? null);
  private requestId = crypto.randomUUID();
  private lastPayload = '';
  protected readonly form = this.builder.group({
    name: ['', fieldValidator('name')],
    email: ['', fieldValidator('email')],
    phone: ['', fieldValidator('phone')],
    major: ['', fieldValidator('major')],
    gender: ['', fieldValidator('gender')],
  });

  protected submit(): void {
    if (this.pending()) return;
    this.form.markAllAsTouched();
    const result = registrationSchema.safeParse(this.form.getRawValue());
    if (!result.success) {
      this.error.set('Please check the highlighted fields before continuing.');
      this.host.nativeElement
        .querySelector<HTMLElement>('input.ng-invalid, mat-select.ng-invalid')
        ?.focus();
      return;
    }
    const payload = JSON.stringify(result.data);
    if (payload !== this.lastPayload) {
      this.requestId = crypto.randomUUID();
      this.lastPayload = payload;
    }
    this.pending.set(true);
    this.form.disable({ emitEvent: false });
    this.error.set('');
    this.gateway
      .register({
        eventId: EVENT_CONFIG.eventId,
        requestId: this.requestId,
        registration: result.data,
      })
      .pipe(
        finalize(() => {
          this.pending.set(false);
          this.form.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (event) => {
          const firstName = result.data.name.split(/\s+/)[0];
          this.receipts.save(event, firstName);
          this.success.set(firstName);
          this.form.reset();
        },
        error: (error: unknown) =>
          this.error.set(
            error instanceof Error ? error.message : 'Something went wrong. Please try again.',
          ),
      });
  }

  protected reset(): void {
    this.receipts.forget();
    this.success.set(null);
    this.error.set('');
    this.requestId = crypto.randomUUID();
    this.lastPayload = '';
  }
}
