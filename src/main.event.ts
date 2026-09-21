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
        path: '',
        loadChildren: () =>
          import('./app/features/event/event.routes').then((module) => module.eventRoutes),
      },
      { path: '**', redirectTo: 'register' },
    ]),
  ],
}).catch((error) => console.error('AI EXPO 2026 could not start.', error));
