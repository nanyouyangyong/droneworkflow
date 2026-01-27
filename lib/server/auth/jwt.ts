import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ============================================================================
// Configuration
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || "drone-workflow-secret-key-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "drone-workflow-refresh-secret-key";
const ACCESS_TOKEN_EXPIRES = 60 * 60 * 2; // 2 hours
const REFRESH_TOKEN_EXPIRES = 60 * 60 * 24 * 7; // 7 days

// ============================================================================
// Helper Functions
// ============================================================================

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf-8");
}

function createSignature(header: string, payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${header}.${payload}`);
  return base64UrlEncode(hmac.digest("base64"));
}

// ============================================================================
// JWT Functions
// ============================================================================

/**
 * 生成 JWT Token
 */
export function signToken(
  payload: Omit<JWTPayload, "iat" | "exp">,
  expiresIn: number = ACCESS_TOKEN_EXPIRES,
  secret: string = JWT_SECRET
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createSignature(header, encodedPayload, secret);

  return `${header}.${encodedPayload}.${signature}`;
}

/**
 * 验证并解析 JWT Token
 */
export function verifyToken(token: string, secret: string = JWT_SECRET): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    // 验证签名
    const expectedSignature = createSignature(header, payload, secret);
    if (signature !== expectedSignature) return null;

    // 解析 payload
    const decoded = JSON.parse(base64UrlDecode(payload)) as JWTPayload;

    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * 生成 Token 对（access + refresh）
 */
export function generateTokenPair(user: { userId: string; email: string; role: string }): TokenPair {
  const accessToken = signToken(
    { userId: user.userId, email: user.email, role: user.role },
    ACCESS_TOKEN_EXPIRES,
    JWT_SECRET
  );

  const refreshToken = signToken(
    { userId: user.userId, email: user.email, role: user.role },
    REFRESH_TOKEN_EXPIRES,
    JWT_REFRESH_SECRET
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES,
  };
}

/**
 * 刷新 Access Token
 */
export function refreshAccessToken(refreshToken: string): TokenPair | null {
  const payload = verifyToken(refreshToken, JWT_REFRESH_SECRET);
  if (!payload) return null;

  return generateTokenPair({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  });
}

/**
 * 从请求头提取 Token
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
