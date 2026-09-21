import { displayName, registrationSchema, welcomeSchema } from './domain';

describe('Registration contract', () => {
  const valid = {
    name: 'أحمد سعدية',
    email: '  AHMAD@example.com ',
    phone: '+962 79 123 4567',
    major: 'Computer Science',
    gender: 'Male',
    showName: true,
  };
  it('normalizes email and international phone while accepting Arabic names', () => {
    const result = registrationSchema.parse(valid);
    expect(result.email).toBe('ahmad@example.com');
    expect(result.phone).toBe('+962791234567');
    expect(displayName(result)).toBe('أحمد سعدية');
  });
  it('rejects ambiguous local phone numbers and values outside the major list', () => {
    expect(registrationSchema.safeParse({ ...valid, phone: '0791234567' }).success).toBeFalse();
    expect(registrationSchema.safeParse({ ...valid, major: 'Unknown' }).success).toBeFalse();
    expect(
      registrationSchema.safeParse({ ...valid, name: '<script>alert(1)</script>' }).success,
    ).toBeFalse();
  });
  it('always greets by full name and strips contact fields from events', () => {
    expect(displayName(registrationSchema.parse({ ...valid, showName: false }))).toBe(valid.name);
    expect(registrationSchema.parse({ ...valid, showName: undefined }).showName).toBeTrue();
    const event = welcomeSchema.parse({
      id: crypto.randomUUID(),
      displayName: null,
      createdAt: new Date().toISOString(),
      email: 'private@example.com',
    });
    expect(Object.keys(event)).toEqual(['id', 'displayName', 'createdAt']);
  });
  it('rejects punctuation-only names, phone extensions, and invalid gender values', () => {
    for (const name of ['--', '...', ' A ']) {
      expect(registrationSchema.safeParse({ ...valid, name }).success).toBeFalse();
    }
    expect(
      registrationSchema.safeParse({ ...valid, phone: '+962791234567 ext 123' }).success,
    ).toBeFalse();
    expect(registrationSchema.safeParse({ ...valid, gender: 'invalid' }).success).toBeFalse();
    expect(registrationSchema.parse({ ...valid, name: '  Lina   Omar  ' }).name).toBe('Lina Omar');
  });
});
