import { RegistrationReceiptService } from './registration-receipt.service';

describe('Device registration receipt', () => {
  const event = {
    id: crypto.randomUUID(),
    displayName: 'Lina',
    createdAt: new Date().toISOString(),
  };
  let stored: string | null;
  beforeEach(() => {
    stored = null;
    spyOn(Storage.prototype, 'getItem').and.callFake(() => stored);
    spyOn(Storage.prototype, 'setItem').and.callFake((_key, value) => {
      stored = value;
    });
    spyOn(Storage.prototype, 'removeItem').and.callFake(() => {
      stored = null;
    });
  });
  it('restores a minimal receipt after reload and forgets it for the next participant', () => {
    new RegistrationReceiptService().save(event, 'Lina');
    const reloaded = new RegistrationReceiptService();
    expect(reloaded.receipt()?.id).toBe(event.id);
    expect(Object.keys(JSON.parse(stored ?? '{}'))).toEqual(['id', 'firstName', 'createdAt']);
    reloaded.forget();
    expect(new RegistrationReceiptService().receipt()).toBeNull();
  });
  it('keeps successful confirmation if browser storage is blocked', () => {
    (Storage.prototype.setItem as jasmine.Spy).and.throwError('Quota exceeded');
    const service = new RegistrationReceiptService();
    expect(() => service.save(event, 'Lina')).not.toThrow();
    expect(service.receipt()?.id).toBe(event.id);
    expect(service.storageAvailable()).toBeFalse();
  });
  it('ignores corrupt or invalid local data', () => {
    stored = '{invalid';
    expect(new RegistrationReceiptService().receipt()).toBeNull();
    stored = '{"id":"fake","firstName":"Lina"}';
    expect(new RegistrationReceiptService().receipt()).toBeNull();
  });
});
