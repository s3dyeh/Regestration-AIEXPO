import { MatMenuModule } from '@angular/material/menu';
import { DashboardActions } from '../dashboard/dashboard-actions';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { EVENT_GATEWAY } from '../data/event-gateway';
import { EVENT_BRAND } from '../event-brand';
import { EventPartnersComponent } from './event-partners.component';

@Component({
  selector: 'app-event-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterOutlet, EventPartnersComponent, MatMenuModule],
  providers: [DashboardActions],
  template: `
    <div
      class="event-app"
      [class.dashboard-mode]="dashboardMode()"
      [style.--event-accent]="brand.colors.primary"
      [style.--event-secondary]="brand.colors.secondary"
    >
      <header class="event-header">
        <a routerLink="/register" class="brand" [attr.aria-label]="brand.name + ' home'"
          ><img
            class="event-logo"
            [src]="brand.logo"
            [alt]="brand.name"
            width="620"
            height="200"
          /><span class="brand-year">2026</span></a
        >
        <div class="header-sponsor" aria-label="Sponsored by Realsoft">
          @if (actions.controls(); as controls) {
            <button
              type="button"
              class="sponsor-menu-trigger"
              [matMenuTriggerFor]="dashboardMenu"
              aria-label="Realsoft — dashboard actions"
            >
              <img [src]="sponsor.logo" [alt]="sponsor.name" width="180" height="48" />
            </button>
            <mat-menu #dashboardMenu="matMenu" class="expo-actions-menu" xPosition="before">
              <button mat-menu-item (click)="controls.toggleWelcomes()">
                <span class="material-icons" aria-hidden="true">{{
                  controls.welcomesEnabled() ? 'pause' : 'play_arrow'
                }}</span>
                {{ controls.welcomesEnabled() ? 'Pause welcomes' : 'Resume welcomes' }}
              </button>
              <button mat-menu-item (click)="controls.present()">
                <span class="material-icons" aria-hidden="true">fullscreen</span> Present
              </button>
              @if (controls.canSignOut) {
                <button mat-menu-item (click)="controls.signOut()">
                  <span class="material-icons" aria-hidden="true">logout</span> Sign out
                </button>
              }
            </mat-menu>
          } @else {
            <img [src]="sponsor.logo" [alt]="sponsor.name" width="180" height="48" />
          }
        </div>
        <span class="organizer"
          >The future, in one place.<strong>{{ brand.venue }}</strong></span
        >
      </header>
      @if (gateway.demo) {
        <div class="demo-banner">
          Local demo
          <span
            >Registrations stay in this browser. Open the live room in another tab to try it.</span
          >
        </div>
      }
      <router-outlet />
      <app-event-partners />
      <footer class="event-footer">
        <span>{{ brand.name }} · {{ brand.venue }}</span
        ><span>{{ brand.organizer }}</span>
      </footer>
    </div>
  `,
  styleUrl: './event-shell.component.scss',
})
export class EventShellComponent {
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly dashboardMode = computed(
    () => this.currentUrl().split(/[?#]/)[0] === '/dashboard',
  );
  protected readonly actions = inject(DashboardActions);
  protected readonly brand = EVENT_BRAND;
  protected readonly sponsor = EVENT_BRAND.partners.find((partner) => partner.kind === 'sponsor')!;
  protected readonly gateway = inject(EVENT_GATEWAY);
}
