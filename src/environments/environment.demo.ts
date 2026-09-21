import { sharedEnvironment as base } from './environment.shared';

/** Explicit offline preview and browser-test configuration. */
export const environment = { ...base, eventDataMode: 'demo' as const, showDemoArrivals: true };
