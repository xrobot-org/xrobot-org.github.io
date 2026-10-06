/**
 * Clipboard write with an execCommand fallback, reporting actual success so
 * callers never show "copied" when every strategy was rejected.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* clipboard API rejected or unavailable: try the legacy path */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'true');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  try {
    document.body.appendChild(area);
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
