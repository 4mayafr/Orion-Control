/**
 * Stateless session tokens.
 *
 * A signed JWT lives in an HttpOnly, SameSite=Lax cookie. The token contains
 * only identity claims (never permissions): permissions are re-resolved from the
 * database on every request, so suspending an operator takes effect immediately.
 */

import { SignJWT, jwtVerify } from 'jose';
import { isRole, type Role } from '@orion/shared';
import { env } from '../env';

export const SESSION_COOKIE = 'orion_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours
const ISSUER = 'orion-control';
const AUDIENCE = 'orion-control-web';

export interface SessionClaims {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: claims.email,
    name: claims.name,
    role: claims.role,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuedAt(issuedAt)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(issuedAt + SESSION_MAX_AGE_SECONDS)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      !isRole(payload.role)
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function clearedSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
}
