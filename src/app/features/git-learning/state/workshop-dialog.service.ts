import { Injectable, signal } from '@angular/core';
export type WorkshopDialog =
  | { kind: 'course' | 'reference' | 'settings' | 'reset' | 'fullscreen' }
  | { kind: 'commit'; id: string };
@Injectable()
export class WorkshopDialogService {
  private readonly current = signal<WorkshopDialog | null>(null);
  readonly selection = this.current.asReadonly();
  open(dialog: WorkshopDialog): void {
    this.current.set(dialog);
  }
  close(): void {
    this.current.set(null);
  }
}
