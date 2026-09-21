import { sharedEnvironment } from './environment.shared';

export const environment = {
  ...sharedEnvironment,
  production: false,
  eventDataMode: 'supabase' as const,
  showDemoArrivals: false,
};
