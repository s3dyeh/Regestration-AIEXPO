import { environment } from '@environments/environment';
import { EVENT_BRAND } from './event-brand';

/** Public configuration only. Never put a service-role key here. */
export const EVENT_CONFIG = {
  mode: environment.eventDataMode as 'supabase' | 'demo',
  showDemoArrivals: environment.showDemoArrivals,
  eventId: 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1',
  name: EVENT_BRAND.name,
  organizer: EVENT_BRAND.organizer,
  supabaseUrl: 'https://eibwjkrickjbktaqsaus.supabase.co',
  supabasePublishableKey: 'sb_publishable_G23ChoDXSBwFshJbpeQPew_NDOb6XiU',
  registrationUrl: '', // Set the public HTTPS /register URL before displaying the QR code.
} as const;
