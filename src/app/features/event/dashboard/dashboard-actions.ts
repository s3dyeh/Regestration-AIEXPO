import { Injectable, signal } from '@angular/core';
import type { DestroyRef, Signal } from '@angular/core';

interface DashboardControls {
  welcomesEnabled: Signal<boolean>;
  canSignOut: boolean;
  toggleWelcomes(): void;
  present(): void;
  signOut(): void;
}

/** Connects the header menu to the currently mounted, authorized dashboard. */
@Injectable()
export class DashboardActions {
  private readonly active = signal<DashboardControls | null>(null);
  readonly controls = this.active.asReadonly();

  register(controls: DashboardControls, destroyRef: DestroyRef): void {
    this.active.set(controls);
    destroyRef.onDestroy(() => {
      if (this.active() === controls) this.active.set(null);
    });
  }
}
