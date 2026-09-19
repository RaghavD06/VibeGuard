import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'vibeguard-local-development-secret');
const DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
const JWT_ISSUER = 'vibeguard-api';
const JWT_AUDIENCE = 'vibeguard';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production.');
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
}

interface DecodedToken extends AuthenticatedUser {
  tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Hashes a plaintext password using scrypt with a unique random salt.
 * Output format: <salt_hex>:<derived_key_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against an scrypt stored hash using timingSafeEqual.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) {
    return false;
  }
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Helper to base64url encode a string or Buffer.
 */
function base64url(input: string | Buffer): string {
  const base64 = (typeof input === 'string' ? Buffer.from(input, 'utf-8') : input).toString('base64');
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Helper to decode base64url string to Buffer.
 */
function unbase64url(input: string): Buffer {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Generates an RFC 7519 compliant HMAC-SHA256 JWT token.
 */
export function createToken(
  user: { id: string; email: string; name?: string | null; tokenVersion?: number },
  expiresInSeconds: number = DEFAULT_EXPIRATION_SECONDS
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    id: user.id,
    email: user.email,
    name: user.name || null,
    ver: user.tokenVersion ?? 0,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + expiresInSeconds
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest();
  const signatureB64 = base64url(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Validates and decodes an HMAC-SHA256 JWT token.
 */
export function verifyToken(token: string): DecodedToken | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const dataToSign = `${headerB64}.${payloadB64}`;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest();
  const actualSignature = unbase64url(signatureB64);

  if (expectedSignature.length !== actualSignature.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expectedSignature, actualSignature)) {
    return null;
  }

  try {
    const payloadJson = unbase64url(payloadB64).toString('utf-8');
    const payload = JSON.parse(payloadJson);

    const header = JSON.parse(unbase64url(headerB64).toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'HS256' || header.typ !== 'JWT' ||
        !Number.isInteger(payload.exp) || payload.exp <= now ||
        !Number.isInteger(payload.iat) || payload.iat > now ||
        typeof payload.id !== 'string' || !payload.id ||
        typeof payload.email !== 'string' || !payload.email ||
        payload.sub !== payload.id ||
        payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE ||
        !Number.isSafeInteger(payload.ver) || payload.ver < 0) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name || null,
      tokenVersion: payload.ver
    };
  } catch {
    return null;
  }
}

/**
 * Express middleware to require valid user authentication.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7).trim();
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized: Token is invalid or expired' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, tokenVersion: true }
    });

    if (!user || user.email !== decoded.email || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Unauthorized: Account no longer exists' });
    }

    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify user credentials' });
  }
}

/**
 * Helper to verify repository membership / ownership.
 * Returns the repository record if authorized, or null otherwise.
 */
export async function verifyRepositoryAccess(
  repositoryId: string,
  userId: string,
  requiredRole?: 'OWNER' | 'MEMBER'
) {
  const repo = await prisma.repository.findUnique({
    where: { id: repositoryId },
    include: { members: true }
  });

  if (!repo) {
    return null;
  }

  // Direct owner
  if (repo.ownerId === userId) {
    return repo;
  }

  // Membership check
  const member = repo.members.find(m => m.userId === userId);
  if (!member) {
    return null;
  }

  if (requiredRole === 'OWNER' && member.role !== 'OWNER') {
    return null;
  }

  return repo;
}
