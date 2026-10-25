/** Copy an existing browser value once, without deleting its fallback on storage errors. */
export function readBrandedStorage(key: string, previousKey: string): string | null {
  const current = localStorage.getItem(key);
  if (current !== null) return current;
  const previous = localStorage.getItem(previousKey);
  if (previous !== null) {
    try { localStorage.setItem(key, previous); } catch { /* Keep reading the original value. */ }
  }
  return previous;
}
