/**
 * Guard against empty path parameters.
 *
 * Without this, `templates.retrieve('')` would silently request the collection
 * endpoint and return a list where the caller expected a single record.
 */
export function pathSegment(value: string, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Pulsenote: \`${name}\` is required and must be a non-empty string`);
  }
  return encodeURIComponent(value);
}
