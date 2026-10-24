const metricKeys = ["budget", "satisfaction", "housingCost", "prosperity", "climate"];
const groupKeys = ["people", "business", "civil"];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Only repair unambiguous container mistakes in raw model output, before validation.
 * Never use this on signed proposals or saves. Values and unknown fields are untouched.
 */
function normalizeEffects(input: unknown): unknown {
  if (!record(input) || !record(input.metrics) || !record(input.groups)) return input;
  const metrics = { ...input.metrics }, groups = { ...input.groups };
  for (const [keys, source, target] of [[groupKeys, metrics, groups], [metricKeys, groups, metrics]] as const) {
    for (const key of keys) {
      if (!(key in source)) continue;
      // Ambiguous conflicting values must still fail the strict schema.
      if (key in target && target[key] !== source[key]) return input;
      target[key] = source[key];
      delete source[key];
    }
  }
  return { ...input, metrics, groups };
}

export function normalizeModelAnalysis(input: unknown): unknown {
  if (!record(input)) return input;
  return {
    ...input, immediate: normalizeEffects(input.immediate),
    delayed: Array.isArray(input.delayed) ? input.delayed.map(item => record(item) ? { ...item, effects: normalizeEffects(item.effects) } : item) : input.delayed,
  };
}
