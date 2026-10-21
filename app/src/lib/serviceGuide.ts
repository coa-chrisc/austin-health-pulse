/**
 * Service Guide deep link for a ZIP. The guide's /services route reads `?zip=`.
 * `baseUrl` may or may not end with a slash; the ZIP is URL-encoded.
 */
export function buildZipServicesUrl(baseUrl: string, zip: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/services?zip=${encodeURIComponent(zip)}`;
}
