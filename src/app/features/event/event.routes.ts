import type { Routes } from '@angular/router';
import { EVENT_CONFIG } from './event-config';
import { EVENT_GATEWAY } from './data/event-gateway';
import { DemoEventGateway } from './data/demo-event-gateway';
import { SupabaseEventGateway } from './data/supabase-event-gateway';

export const eventRoutes: Routes = [
  {
    path: '',
    providers: [
      {
        provide: EVENT_GATEWAY,
        useClass: EVENT_CONFIG.mode === 'demo' ? DemoEventGateway : SupabaseEventGateway,
      },
    ],
    loadComponent: () =>
      import('./ui/event-shell.component').then((module) => module.EventShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'register' },
      {
        path: 'register',
        title: 'Join AI EXPO 2026 | University of Jordan',
        loadComponent: () =>
          import('./registration/registration.component').then(
            (module) => module.RegistrationComponent,
          ),
      },
      {
        path: 'dashboard',
        title: 'AI EXPO 2026 | Live room',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((module) => module.DashboardComponent),
      },
    ],
  },
];
