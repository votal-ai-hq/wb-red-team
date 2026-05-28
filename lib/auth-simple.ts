import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { query, isDbConfigured } from "./db.js";
import { generateTenantKey } from "./encryption.js";
import type { AuthContext } from "./auth.js";
import type { Role } from "./rbac.js";

interface SimpleAuthUser {
  username: string;
  password: string;
  role: Role;
  email?: string;
  name?: string;
}

interface SessionPayload {
  username: string;
  role: Role;
  sid: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}

export interface SimpleAuthUserInfo {
  username: string;
  role: Role;
  email?: string;
  name: string;
}

function getSessionCookieName(): string {
  // Use __Host- prefix when Secure flag is enabled (prevents subdomain attacks)
  return getCookieSecure() ? "__Host-rt_session" : "rt_session";
}

function getSessionSecret(): string {
  const secret =
    process.env.SIMPLE_AUTH_SESSION_SECRET || process.env.SESSION_SECRET;

  if (!secret) {
    if (process.env.AUTH_MODE === "simple") {
      throw new Error(
        "SIMPLE_AUTH_SESSION_SECRET must be set when AUTH_MODE=simple. " +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    return "dev-only-simple-auth-secret";
  }

  if (secret.length < 32) {
    console.warn(
      "WARNING: SIMPLE_AUTH_SESSION_SECRET is shorter than 32 characters. Use a stronger secret in production.",
    );
  }

  return secret;
}

function getSessionTtlSeconds(): number {
  const hours = parseInt(process.env.SIMPLE_AUTH_SESSION_TTL_HOURS || "12", 10);
  return Math.max(1, hours) * 60 * 60;
}

function getCookieSecure(): boolean {
  if (process.env.SIMPLE_AUTH_COOKIE_SECURE === "false") return false;
  return true;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function parseSimpleAuthUsers(): SimpleAuthUser[] {
  if (process.env.SIMPLE_AUTH_USERS) {
    const raw = JSON.parse(process.env.SIMPLE_AUTH_USERS) as unknown;
    if (!Array.isArray(raw)) {
      throw new Error("SIMPLE_AUTH_USERS must be a JSON array");
    }
    return raw.map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        throw new Error(`SIMPLE_AUTH_USERS[${index}] must be an object`);
      }
      const user = entry as Record<string, unknown>;
      const username = String(user.username || "").trim();
      const password = String(user.password || "");
      const role = String(user.role || "viewer") as Role;
      if (!username || !password) {
        throw new Error(
          `SIMPLE_AUTH_USERS[${index}] must include username and password`,
        );
      }
      if (!["admin", "viewer", "auditor"].includes(role)) {
        throw new Error(
          `SIMPLE_AUTH_USERS[${index}].role must be admin, viewer, or auditor`,
        );
      }
      return {
        username,
        password,
        role,
        email: typeof user.email === "string" ? user.email : undefined,
        name: typeof user.name === "string" ? user.name : undefined,
      };
    });
  }

  const username = (process.env.SIMPLE_AUTH_USERNAME || "").trim();
  const password = process.env.SIMPLE_AUTH_PASSWORD || "";
  if (!username || !password) {
    throw new Error(
      "Simple auth requires SIMPLE_AUTH_USERS or SIMPLE_AUTH_USERNAME and SIMPLE_AUTH_PASSWORD",
    );
  }

  const role = (process.env.SIMPLE_AUTH_ROLE || "admin") as Role;
  if (!["admin", "viewer", "auditor"].includes(role)) {
    throw new Error("SIMPLE_AUTH_ROLE must be admin, viewer, or auditor");
  }

  return [
    {
      username,
      password,
      role,
      email: process.env.SIMPLE_AUTH_EMAIL || undefined,
      name: process.env.SIMPLE_AUTH_NAME || undefined,
    },
  ];
}

function findSimpleAuthUser(username: string): SimpleAuthUser | undefined {
  return parseSimpleAuthUsers().find((user) => user.username === username);
}

function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
  }
  return cookies;
}

async function ensureSimpleAuthContext(
  user: SimpleAuthUser,
): Promise<AuthContext> {
  if (!isDbConfigured()) {
    return {
      sub: `simple:${user.username}`,
      email: user.email,
      tenantId: "local",
      role: user.role,
      userId: user.username,
    };
  }

  const tenantName = process.env.SIMPLE_AUTH_TENANT || "default";
  let tenantId: string;
  const existingTenant = await query<{ id: string }>(
    "SELECT id FROM tenants WHERE name = $1",
    [tenantName],
  );
  if (existingTenant.rows.length > 0) {
    tenantId = existingTenant.rows[0].id;
  } else {
    const encKey = generateTenantKey();
    const createdTenant = await query<{ id: string }>(
      `INSERT INTO tenants (name, oidc_issuer, encryption_key_enc)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [tenantName, `simple-auth:${tenantName}`, encKey],
    );
    tenantId = createdTenant.rows[0].id;
  }

  const sub = `simple:${user.username}`;
  const email = user.email || `${user.username}@local`;
  const userResult = await query<{ id: string; role: string }>(
    `INSERT INTO users (tenant_id, sub, email, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, sub) DO UPDATE
       SET email = EXCLUDED.email,
           role = EXCLUDED.role
     RETURNING id, role`,
    [tenantId, sub, email, user.role],
  );

  return {
    sub,
    email,
    tenantId,
    role: userResult.rows[0].role as Role,
    userId: userResult.rows[0].id,
  };
}

const JWT_HEADER = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));

function serializeSession(payload: SessionPayload): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${JWT_HEADER}.${encodedPayload}`;
  const signature = signPayload(signingInput);
  return `${JWT_HEADER}.${encodedPayload}.${signature}`;
}

function deserializeSession(token: string): SessionPayload {
  const parts = token.split(".");
  // Support both legacy 2-part (payload.sig) and standard 3-part JWT (header.payload.sig)
  let encodedPayload: string;
  let signature: string;
  let signingInput: string;
  if (parts.length === 3) {
    // Standard JWT: header.payload.signature
    encodedPayload = parts[1];
    signature = parts[2];
    signingInput = `${parts[0]}.${parts[1]}`;
  } else if (parts.length === 2) {
    // Legacy format: payload.signature (backward compat for active sessions)
    encodedPayload = parts[0];
    signature = parts[1];
    signingInput = parts[0];
  } else {
    throw new Error("Invalid session token");
  }
  if (!encodedPayload || !signature) {
    throw new Error("Invalid session token");
  }
  const expected = signPayload(signingInput);
  if (!safeCompare(signature, expected)) {
    throw new Error("Invalid session signature");
  }
  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
  if (
    !payload.username ||
    typeof payload.exp !== "number" ||
    !payload.role ||
    !payload.sid ||
    typeof payload.iat !== "number"
  ) {
    throw new Error("Invalid session payload — please log in again");
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Session expired");
  }
  // Validate issuer/audience if present (new tokens always have them)
  if (payload.iss && payload.iss !== "red-team-dashboard") {
    throw new Error("Invalid token issuer");
  }
  if (payload.aud && payload.aud !== "red-team-session") {
    throw new Error("Invalid token audience");
  }
  return payload;
}

export async function loginSimpleUser(
  username: string,
  password: string,
): Promise<{ auth: AuthContext; user: SimpleAuthUserInfo; token: string }> {
  const user = findSimpleAuthUser(username);
  if (!user) {
    // Constant-time: always run a bcrypt compare even if user not found
    await bcrypt.compare(password, "$2a$10$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXX");
    throw new Error("Invalid username or password");
  }

  // Support bcrypt hashes ($2a$, $2b$, $2y$) and plaintext (backward compat)
  const isBcrypt = /^\$2[aby]\$\d+\$/.test(user.password);
  const passwordValid = isBcrypt
    ? await bcrypt.compare(password, user.password)
    : user.password === password;
  if (!passwordValid) {
    throw new Error("Invalid username or password");
  }

  const auth = await ensureSimpleAuthContext(user);
  const now = Math.floor(Date.now() / 1000);
  const token = serializeSession({
    username: user.username,
    role: user.role,
    sid: randomUUID(),
    exp: now + getSessionTtlSeconds(),
    iat: now,
    iss: "red-team-dashboard",
    aud: "red-team-session",
  });

  return {
    auth,
    token,
    user: {
      username: user.username,
      role: auth.role,
      email: user.email,
      name: user.name || user.username,
    },
  };
}

export async function validateSimpleSession(
  cookieHeader: string | undefined,
): Promise<AuthContext> {
  const cookies = parseCookies(cookieHeader);
  // Check current cookie name, fall back to legacy name for active sessions during migration
  const token = cookies[getSessionCookieName()] || cookies["rt_session"] || cookies["__Host-rt_session"];
  if (!token) {
    throw new Error("Missing session cookie");
  }

  const payload = deserializeSession(token);
  const user = findSimpleAuthUser(payload.username);
  if (!user) {
    throw new Error("User no longer exists");
  }
  if (user.role !== payload.role) {
    throw new Error("Session role mismatch — please log in again");
  }

  return ensureSimpleAuthContext(user);
}

export async function getSimpleSessionUser(
  cookieHeader: string | undefined,
): Promise<SimpleAuthUserInfo> {
  const auth = await validateSimpleSession(cookieHeader);
  const user = findSimpleAuthUser(auth.sub.replace(/^simple:/, ""));
  if (!user) {
    throw new Error("User no longer exists");
  }
  return {
    username: user.username,
    role: auth.role,
    email: user.email,
    name: user.name || user.username,
  };
}

export function buildSimpleSessionCookie(token: string): string {
  const maxAge = getSessionTtlSeconds();
  const secure = getCookieSecure() ? "; Secure" : "";
  return `${getSessionCookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function buildSimpleLogoutCookie(): string {
  const secure = getCookieSecure() ? "; Secure" : "";
  return `${getSessionCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
