import type { Routes } from '@angular/router';
import { workshopTranslationProviders } from './i18n/workshop-i18n';

export const gitLearningRoutes: Routes = [
  {
    path: '',
    providers: workshopTranslationProviders,
    loadComponent: () =>
      import('./git-learning.component').then((module) => module.GitLearningComponent),
  },
];
