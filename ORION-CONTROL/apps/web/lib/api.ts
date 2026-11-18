/**
 * HTTP helpers for route handlers.
 *
 * Every API route funnels errors through `errorResponse` so that:
 *   - validation problems return a useful 400,
 *   - authentication problems return 401/403,
 *   - unexpected database errors never leak internals to the browser.
 */

import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unauthorized = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');

export const forbidden = () =>
  new ApiError(403, 'FORBIDDEN', 'Your operator account does not have permission for this action.');

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request contains invalid fields.',
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }
  console.error('[orion:api] Unhandled error:', error);
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong on the server. Check the deployment logs for details.',
      },
    },
    { status: 500 },
  );
}

/** Surface storage configuration problems instead of a generic 500. */
export function storageAwareErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : '';
  if (/DATABASE_URL|PostgreSQL|storage driver/i.test(message)) {
    return errorResponse(
      new ApiError(
        503,
        'STORAGE_UNAVAILABLE',
        `${message} Check DATABASE_URL and run the database migrations (npm run db:migrate).`,
      ),
    );
  }
  return errorResponse(error);
}

export async function parseJson<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The request contains invalid fields.', result.error.flatten());
  }
  return result.data;
}

/**
 * Basic CSRF protection for cookie-authenticated mutations: when a browser sends
 * an Origin header it must match the host serving the request.
 * Worker requests use bearer keys and normally omit Origin, so they are exempt.
 */
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) {
    throw new ApiError(400, 'MISSING_HOST', 'Could not determine the request host.');
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'BAD_ORIGIN', 'Cross-origin requests are not allowed.');
  }
  if (originHost !== host) {
    throw new ApiError(403, 'BAD_ORIGIN', 'Cross-origin requests are not allowed.');
  }
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip');
}

export function pageParams<T extends Record<string, string | string[] | undefined>>(url: string): T {
  return Object.fromEntries(new URL(url).searchParams.entries()) as T;
}
