import { environment } from '@environments/environment';

/** Public configuration only. Never put a service-role key here. */
export const EVENT_CONFIG = {
  mode: environment.eventDataMode as 'supabase' | 'demo',
  showDemoArrivals: environment.showDemoArrivals,
  eventId: 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1',
  supabaseUrl: 'https://eibwjkrickjbktaqsaus.supabase.co',
  supabasePublishableKey: 'sb_publishable_G23ChoDXSBwFshJbpeQPew_NDOb6XiU',
} as const;
