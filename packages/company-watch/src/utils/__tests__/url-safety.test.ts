import { describe, it, expect, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (hostname: string) => {
    if (hostname === 'public.example.com') return [{ address: '93.184.216.34' }];
    if (hostname === 'rebinder.example.com') return [{ address: '169.254.169.254' }];
    if (hostname === 'unresolvable.invalid') throw new Error('ENOTFOUND');
    return [{ address: '93.184.216.34' }];
  }),
}));

const { assertSafeUrl, UnsafeUrlError } = await import('../url-safety.js');

describe('assertSafeUrl', () => {
  it('allows a normal https URL to a public host', async () => {
    await expect(assertSafeUrl('https://public.example.com/careers')).resolves.toBeUndefined();
  });

  it('rejects non-https schemes', async () => {
    await expect(assertSafeUrl('http://public.example.com')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('ftp://public.example.com')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects localhost', async () => {
    await expect(assertSafeUrl('https://localhost/careers')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('https://foo.localhost/careers')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects literal private/loopback/link-local IPs', async () => {
    await expect(assertSafeUrl('https://127.0.0.1/careers')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('https://10.0.0.5/careers')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('https://192.168.1.1/careers')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('https://172.16.0.1/careers')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects the cloud metadata endpoint', async () => {
    await expect(assertSafeUrl('https://169.254.169.254/latest/meta-data/')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects a hostname that resolves to a disallowed address (DNS rebinding)', async () => {
    await expect(assertSafeUrl('https://rebinder.example.com/careers')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects a hostname that fails to resolve', async () => {
    await expect(assertSafeUrl('https://unresolvable.invalid/careers')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects a malformed URL', async () => {
    await expect(assertSafeUrl('not a url')).rejects.toThrow(UnsafeUrlError);
  });
});
