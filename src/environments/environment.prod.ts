import { sharedEnvironment } from './environment.shared';

export const environment = {
  ...sharedEnvironment,
  production: true,
  eventDataMode: 'supabase' as const,
  showDemoArrivals: false,
};
