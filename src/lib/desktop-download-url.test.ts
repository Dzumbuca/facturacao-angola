import { describe, expect, it } from 'vitest';
import { getDesktopDownloadUrl } from './desktop-download-url';

describe('desktop download URL', () => {
  it('renders only a configured HTTPS URL without embedded credentials', () => {
    expect(getDesktopDownloadUrl(undefined)).toBeNull();
    expect(getDesktopDownloadUrl('')).toBeNull();
    expect(getDesktopDownloadUrl('http://downloads.example/setup.exe')).toBeNull();
    expect(getDesktopDownloadUrl('https://user:password@downloads.example/setup.exe')).toBeNull();
    expect(getDesktopDownloadUrl('https://downloads.example/setup.exe')).toBe('https://downloads.example/setup.exe');
  });
});
