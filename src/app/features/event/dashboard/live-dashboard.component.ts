import { majorCategory } from '../data/major-category';
import { RecentArrivalsComponent } from './recent-arrivals.component';
import { ProfileVisualComponent } from './profile-visual.component';
import { CategoryColumnsComponent } from './category-columns.component';
import { DashboardActions } from './dashboard-actions';
import { RevealDirective } from '../ui/reveal.directive';
import { EventMetricsComponent } from './event-metrics.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, concatMap, finalize, switchMap } from 'rxjs';
import { EVENT_GATEWAY } from '../data/event-gateway';
import { EVENT_CONFIG } from '../event-config';
import { MAJORS } from '../domain';
import { WelcomeOverlayComponent } from '../ui/welcome-overlay.component';
import { DashboardStore } from './dashboard.store';
import { UniversitiesChartComponent } from './universities-chart.component';
import type { Dimension } from '../domain';

@Component({
  selector: 'app-live-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RevealDirective,
    EventMetricsComponent,
    RecentArrivalsComponent,
    UniversitiesChartComponent,
    ProfileVisualComponent,
    CategoryColumnsComponent,
    WelcomeOverlayComponent,
  ],
  providers: [DashboardStore],
  templateUrl: './live-dashboard.component.html',
  styleUrl: './live-dashboard.component.scss',
})
export class LiveDashboardComponent {
  readonly signedOut = output<void>();
  protected readonly store = inject(DashboardStore);
  protected readonly gateway = inject(EVENT_GATEWAY);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly actionError = signal('');
  protected readonly showDemoArrivals = EVENT_CONFIG.showDemoArrivals;
  protected readonly adding = signal(false);
  protected distribution(dimension: Dimension) {
    // Derive from actual checked-in majors: old records may have an empty category.
    if (dimension === 'majorCategories') {
      const groups = new Map<string, number>();
      for (const row of this.store.stats().majors) {
        const name = majorCategory(row.name);
        groups.set(name, (groups.get(name) ?? 0) + row.count);
      }
      return [...groups].map(([name, count]) => ({ name, count })).filter((row) => row.count > 0);
    }
    return this.store
      .stats()
      .audience.dimensions[dimension].map((row) => ({ name: row.name, count: row.attended }))
      .filter((row) => row.count > 0);
  }
  constructor() {
    inject(DashboardActions).register(
      {
        welcomesEnabled: this.store.welcomesEnabled.asReadonly(),
        canSignOut: !this.gateway.demo,
        toggleWelcomes: () => this.store.setWelcomes(!this.store.welcomesEnabled()),
        present: () => this.fullscreen(),
        signOut: () => this.signOut(),
      },
      this.destroyRef,
    );
    this.store.start();
  }
  protected fullscreen(): void {
    const operation = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    from(operation)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.actionError.set('Fullscreen is unavailable in this browser.'),
      });
  }
  protected signOut(): void {
    this.gateway
      .signOut()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.signedOut.emit(),
        error: () => this.actionError.set('Could not sign out. Please retry.'),
      });
  }
  protected addDemo(): void {
    if (!this.showDemoArrivals || !this.gateway.demo || this.adding()) return;
    this.adding.set(true);
    const names = [
      'Ahmad Saleh',
      'Lina Omar',
      'Yara Khalil',
      'Omar Hassan',
      'Nour Ali',
      'Zaid Yousef',
      'Sara Nasser',
      'Kareem Sami',
      'Dana Fadi',
      'Rami Adel',
      'Hala Majed',
      'Tariq Amin',
    ];
    const batch = crypto.randomUUID();
    from(names)
      .pipe(
        concatMap((name, index) =>
          this.gateway
            .importParticipants([
              {
                participantId: `${batch}-${index}`,
                fullName: name,
                email: `demo-${batch}-${index}@example.com`,
                isIeeeMember: index % 3 !== 0,
                role: ['Undergraduate', 'Graduate', 'Academic / Researcher'][index % 3],
                universityName: [
                  'The University of Jordan',
                  'Princess Sumaya University for Technology',
                  'Jordan University of Science and Technology',
                ][index % 3],
                major: MAJORS[index % MAJORS.length],
                gender: 'Not Provided',
                majorCategory: majorCategory(MAJORS[index % MAJORS.length]),
                referralSource: ['Social Media', 'University Announcements', 'Family / Friends'][
                  index % 3
                ],
                organizationName: 'Not Provided',
              },
            ])
            .pipe(
              switchMap(() =>
                this.gateway.register({
                  eventId: EVENT_CONFIG.eventId,
                  requestId: crypto.randomUUID(),
                  participantId: `${batch}-${index}`,
                }),
              ),
            ),
        ),
        finalize(() => this.adding.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => this.actionError.set('Could not add demo arrivals. Please retry.'),
      });
  }
}
