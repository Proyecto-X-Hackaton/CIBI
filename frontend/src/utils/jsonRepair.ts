// jsonRepair.ts — MedPsy JSON-mode may return prose around JSON.
// Extract the largest {...} block; one constrained retry happens upstream.

export function repairJson(raw: string): any {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no-json');
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    // Cheap repairs: trailing commas, single quotes around keys
    const fixed = slice
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/'/g, '"');
    return JSON.parse(fixed);
  }
}
