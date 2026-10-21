import { decryptSecret, encryptSecret } from '../secretBox';

describe('secret box', () => {
  it('round-trips a token without keeping it readable', () => {
    const stored = encryptSecret('t.secret-token', 'key-1');
    expect(stored).not.toContain('secret-token');
    expect(encryptSecret('t.secret-token', 'key-1')).not.toBe(stored);
    expect(decryptSecret(stored, 'key-1')).toBe('t.secret-token');
  });

  it('refuses a value encrypted with another key or changed', () => {
    const stored = encryptSecret('t.secret-token', 'key-1');
    expect(() => decryptSecret(stored, 'key-2')).toThrow();
    const [version, iv, tag, data] = stored.split(':');
    const changed = Buffer.from(data, 'base64');
    changed[0] ^= 1;
    expect(() => decryptSecret([version, iv, tag, changed.toString('base64')].join(':'), 'key-1')).toThrow();
  });
});
