import { createAesCodecFromKey } from '@/offline/aesCodec';

// A fixed 256-bit (64 hex char) key for deterministic tests.
const KEY = 'a'.repeat(64);

describe('AES-256-GCM codec', () => {
  it('round-trips plaintext (encrypt → decrypt)', async () => {
    const codec = await createAesCodecFromKey(KEY);
    const plaintext = JSON.stringify({ patient: 'PHI', vitals: [120, 80], note: 'বাংলা' });
    const ciphertext = await codec.encrypt(plaintext);
    expect(ciphertext).not.toContain('PHI'); // not stored in the clear
    expect(ciphertext).not.toEqual(plaintext);
    const decrypted = await codec.decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', async () => {
    const codec = await createAesCodecFromKey(KEY);
    const a = await codec.encrypt('same input');
    const b = await codec.encrypt('same input');
    expect(a).not.toEqual(b);
    expect(await codec.decrypt(a)).toBe('same input');
    expect(await codec.decrypt(b)).toBe('same input');
  });

  it('fails to decrypt a tampered ciphertext (GCM authentication)', async () => {
    const codec = await createAesCodecFromKey(KEY);
    const ct = await codec.encrypt('integrity matters');
    // Flip a character in the base64 body to simulate tampering.
    const tampered = ct.slice(0, -2) + (ct.slice(-2) === 'AA' ? 'BB' : 'AA');
    await expect(codec.decrypt(tampered)).rejects.toBeDefined();
  });

  it('cannot decrypt with a different key', async () => {
    const enc = await createAesCodecFromKey(KEY);
    const dec = await createAesCodecFromKey('b'.repeat(64));
    const ct = await enc.encrypt('secret');
    await expect(dec.decrypt(ct)).rejects.toBeDefined();
  });
});
