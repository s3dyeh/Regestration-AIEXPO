import { DashboardActions } from './dashboard-actions';
import { RevealDirective } from '../ui/reveal.directive';
import { EventMetricsComponent } from './event-metrics.component';
import { RecentArrivalsComponent } from './recent-arrivals.component';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, concatMap, finalize } from 'rxjs';
import { GenderChartComponent } from '../ui/gender-chart.component';
import { EVENT_GATEWAY } from '../data/event-gateway';
import { EVENT_CONFIG } from '../event-config';
import { GENDERS, MAJORS } from '../domain';
import { EventChartComponent } from '../ui/event-chart.component';
import { WelcomeOverlayComponent } from '../ui/welcome-overlay.component';
import { DashboardStore } from './dashboard.store';
import { majorChart, timelineChart } from './chart-options';

@Component({
  selector: 'app-live-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RevealDirective,
    GenderChartComponent,
    DatePipe,
    EventMetricsComponent,
    RecentArrivalsComponent,
    EventChartComponent,
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
  protected readonly majorOptions = computed(() => majorChart(this.store.stats()));
  protected readonly timelineOptions = computed(() => timelineChart(this.store.stats()));
  protected readonly actionError = signal('');
  protected readonly showDemoArrivals = EVENT_CONFIG.showDemoArrivals;
  protected readonly adding = signal(false);
  protected readonly majorSummary = computed(
    () =>
      'Registrations by discipline: ' +
      this.store
        .stats()
        .majors.map((row) => row.name + ': ' + row.count)
        .join(', '),
  );
  protected readonly timelineSummary = computed(
    () =>
      'Registrations by hour: ' +
      this.store
        .stats()
        .timeline.map((row) => row.time + ': ' + row.count)
        .join(', '),
  );
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
          this.gateway.register({
            eventId: EVENT_CONFIG.eventId,
            requestId: crypto.randomUUID(),
            registration: {
              name,
              email: `demo-${batch}-${index}@example.com`,
              phone: '+962791234567',
              major: MAJORS[index % MAJORS.length],
              gender: GENDERS[index % GENDERS.length],
              showName: true,
            },
          }),
        ),
        finalize(() => this.adding.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => this.actionError.set('Could not add demo arrivals. Please retry.'),
      });
  }
}
