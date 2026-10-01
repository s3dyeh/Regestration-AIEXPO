import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { EventApp } from './app/event-app';

bootstrapApplication(EventApp, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter([
      {
        path: 'readme',
        title: 'Start readme now ! | CareerLens AI',
        loadComponent: () =>
          import('./app/features/readme/readme.component').then((module) => module.ReadmeComponent),
      },
      {
        path: 'learn-git',
        title: 'Start learning Git | CareerLens AI',
        loadComponent: () =>
          import('./app/features/git-learning/git-learning.component').then(
            (module) => module.GitLearningComponent,
          ),
      },
      {
        path: '',
        pathMatch: 'full',
        title: 'CareerLens AI | Find your next direction',
        loadComponent: () =>
          import('./app/features/career/career.component').then((module) => module.CareerComponent),
      },
      {
        path: '',
        loadChildren: () =>
          import('./app/features/event/event.routes').then((module) => module.eventRoutes),
      },
      { path: '**', redirectTo: 'register' },
    ]),
  ],
}).catch((error) => console.error('AI EXPO 2026 could not start.', error));
