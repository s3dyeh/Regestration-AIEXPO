import { databaseRegistration, displayName, registrationSchema, welcomeSchema } from './domain';

describe('Registration contract', () => {
  const valid = {
    firstName: 'أحمد',
    lastName: 'سعدية',
    email: '  AHMAD@example.com ',
    phone: '0790000000',
    major: 'Computer Science',
    gender: 'Male',
    showName: true,
  };
  it('normalizes email while accepting local Jordanian phones and Arabic names', () => {
    const result = registrationSchema.parse(valid);
    expect(result.email).toBe('ahmad@example.com');
    expect(result.phone).toBe('0790000000');
    expect(databaseRegistration(result)).toEqual({
      FNAME: 'أحمد',
      LNAME: 'سعدية',
      email: 'ahmad@example.com',
      phone: '+962790000000',
      major: 'Computer Science',
      gender: 'Male',
      showName: true,
    });
    expect(registrationSchema.parse(result)).toEqual(result);
    expect(displayName(result)).toBe('أحمد سعدية');
  });
  it('rejects incorrect phone formats and values outside the major list', () => {
    for (const phone of [
      '',
      '07',
      '079000000',
      '07900000000',
      '0690000000',
      '1790000000',
      '079000000a',
      '+962790000000',
      '079 000 0000',
    ]) {
      expect(registrationSchema.safeParse({ ...valid, phone }).success)
        .withContext(phone)
        .toBeFalse();
    }
    expect(registrationSchema.safeParse({ ...valid, major: 'Unknown' }).success).toBeFalse();
    expect(
      registrationSchema.safeParse({ ...valid, firstName: '<script>alert(1)</script>' }).success,
    ).toBeFalse();
  });
  it('always greets by full name and strips contact fields from events', () => {
    expect(displayName(registrationSchema.parse({ ...valid, showName: false }))).toBe('أحمد سعدية');
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
    for (const name of ['', '   ', '--', '...', 'A'.repeat(50)]) {
      expect(registrationSchema.safeParse({ ...valid, firstName: name }).success).toBeFalse();
      expect(registrationSchema.safeParse({ ...valid, lastName: name }).success).toBeFalse();
    }
    expect(
      registrationSchema.safeParse({ ...valid, phone: '+962791234567 ext 123' }).success,
    ).toBeFalse();
    expect(registrationSchema.safeParse({ ...valid, gender: 'invalid' }).success).toBeFalse();
    expect(registrationSchema.parse({ ...valid, firstName: '  Lina   Noor  ' }).firstName).toBe(
      'Lina Noor',
    );
  });
});
