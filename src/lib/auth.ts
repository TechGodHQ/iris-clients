/**
 * In-memory credential store. Never persisted to localStorage, sessionStorage,
 * URL params, or any durable store. Tokens held only in module-level memory
 * for the lifetime of the browser tab.
 */

export interface Credentials {
  baseUrl: string;
  token: string;
}

let _creds: Credentials | null = null;

export function setCredentials(creds: Credentials): void {
  _creds = { baseUrl: creds.baseUrl.replace(/\/+$/, ""), token: creds.token };
}

export function getCredentials(): Credentials | null {
  return _creds;
}

export function clearCredentials(): void {
  _creds = null;
}

export function isAuthenticated(): boolean {
  return _creds !== null && _creds.token.length > 0;
}

/**
 * Validates a user-supplied endpoint URL.
 *
 * Accepts:
 *   - https:// — any host (recommended for all production and remote use)
 *   - http:// — ONLY for:
 *       localhost, 127.0.0.1, ::1            (loopback)
 *       100.64.0.0/10 CIDR notation          (Tailscale CGNAT range — actual tailnet IPs)
 *       *.ts.net                             (Tailscale MagicDNS hostnames)
 *
 * Deliberate policy: http:// to *.local or *.internal is NOT permitted because
 * those suffixes are not evidence of a real tailnet — any LAN device can claim
 * them. Only actual Tailscale 100.64/10 IPs and *.ts.net MagicDNS names are
 * trusted local HTTP. For all other private/VPN networks use HTTPS.
 *
 * Rejects: non-http(s) schemes, userinfo (user:pass@), query string, fragment.
 * Token must NEVER appear in the URL.
 *
 * Returns cleaned origin+path on success, throws user-visible message on fail.
 */
export function validateEndpoint(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Invalid URL — enter a full URL starting with https://");
  }

  if (url.username || url.password) {
    throw new Error("Endpoint must not include credentials in the URL");
  }
  if (url.search) {
    throw new Error("Endpoint must not include a query string");
  }
  if (url.hash) {
    throw new Error("Endpoint must not include a fragment");
  }

  const scheme = url.protocol; // "https:" or "http:"
  const host = url.hostname.toLowerCase();

  if (scheme === "https:") {
    return url.origin + url.pathname.replace(/\/+$/, "");
  }

  if (scheme === "http:") {
    const isAllowedLocal = isLoopback(host) || isTailscaleHost(host);
    if (!isAllowedLocal) {
      throw new Error(
        "HTTP is only allowed for loopback (localhost/127.0.0.1) or verified Tailscale hosts (100.64.x.x or *.ts.net). Use https:// for all other networks."
      );
    }
    return url.origin + url.pathname.replace(/\/+$/, "");
  }

  throw new Error("Endpoint must use https:// (or http:// for loopback/tailnet only)");
}

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isTailscaleHost(host: string): boolean {
  // Actual Tailscale CGNAT range: 100.64.0.0/10 (100.64.0.0 – 100.127.255.255)
  if (isTailscaleIP(host)) return true;
  // Tailscale MagicDNS: hostnames end in .ts.net
  if (host.endsWith(".ts.net")) return true;
  return false;
}

function isTailscaleIP(host: string): boolean {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
  const parts = host.split(".").map(Number);
  return parts.every(octet => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    && parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}
