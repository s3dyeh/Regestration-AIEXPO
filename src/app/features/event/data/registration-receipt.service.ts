import { Injectable, signal } from '@angular/core';
import { z } from 'zod';
import { EVENT_CONFIG } from '../event-config';
import type { WelcomeEvent } from '../domain';

const receiptSchema = z.object({
  id: z.uuid(),
  firstName: z.string().max(100),
  createdAt: z.iso.datetime({ offset: true }),
});
export type RegistrationReceipt = z.infer<typeof receiptSchema>;
const key = `ai-expo:receipt:${EVENT_CONFIG.eventId}`;

/** A device confirmation, never an authority for admission or duplicate prevention. No contact data. */
@Injectable({ providedIn: 'root' })
export class RegistrationReceiptService {
  readonly receipt = signal<RegistrationReceipt | null>(this.read());
  readonly storageAvailable = signal(true);
  save(event: WelcomeEvent, firstName: string): void {
    const receipt = { id: event.id, firstName, createdAt: event.createdAt };
    this.receipt.set(receipt);
    try {
      localStorage.setItem(key, JSON.stringify(receipt));
    } catch {
      this.storageAvailable.set(false);
    }
  }
  forget(): void {
    this.receipt.set(null);
    try {
      localStorage.removeItem(key);
    } catch {
      this.storageAvailable.set(false);
    }
  }
  private read(): RegistrationReceipt | null {
    try {
      const result = receiptSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null'));
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }
}
