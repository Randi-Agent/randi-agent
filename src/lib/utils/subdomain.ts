const RESERVED_WORDS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "smtp",
  "ftp",
  "ssh",
  "dns",
  "ns1",
  "ns2",
  "cdn",
  "static",
  "assets",
  "media",
  "blog",
  "status",
  "help",
  "support",
  "docs",
  "dashboard",
  "login",
  "auth",
  "traefik",
]);

export function sanitizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

export function isValidUsername(username: string): boolean {
  if (username.length < 3 || username.length > 20) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(username) && username.length > 2) return false;
  if (/^[a-z0-9]$/.test(username)) return false; // too short after sanitization
  if (RESERVED_WORDS.has(username)) return false;
  return true;
}

export function generateSubdomain(username: string, agentSlug: string): string {
  const sanitized = sanitizeUsername(username);
  return `${sanitized}-${agentSlug}`;
}

export function isReservedWord(word: string): boolean {
  return RESERVED_WORDS.has(word.toLowerCase());
}
