/** True in the single-file build published as a hosted artifact (no printing or file downloads there). */
export const IS_ARTIFACT = import.meta.env.MODE === 'artifact';

/** Copy text to the clipboard; resolves false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
