/** Shared identity for both event screens. Partner marks retain their original colors. */
export const EVENT_BRAND = {
  name: 'AI EXPO 2026',
  logo: '/assets/img/event-logo.webp',
  organizer: 'IEEE Computational Intelligence Society',
  venue: 'University of Jordan',
  sponsor: 'Realsoft',
  colors: { primary: '#7a3cff', secondary: '#2cabe2', ink: '#111111', surface: '#ffffff' },
  partners: [
    {
      role: 'Sponsored by',
      name: 'Realsoft',
      logo: '/assets/img/Realsoft-white.png',
      kind: 'sponsor',
    },
    {
      role: 'Hosted at',
      name: 'University of Jordan',
      logo: '/assets/img/University_of_Jordan_Logo.svg.webp',
      kind: 'venue',
    },
    {
      role: 'Organized by',
      name: 'IEEE Computational Intelligence Society',
      logo: '/assets/img/IEEE-Logo-base1-png.webp',
      kind: 'organizer',
    },
  ],
} as const;
