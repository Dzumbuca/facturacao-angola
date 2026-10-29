export function getDesktopDownloadUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}
