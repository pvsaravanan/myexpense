import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, requireUser, type SessionUser } from "./auth";
import { fieldErrors } from "./validation";

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function apiError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status, headers });
}

/**
 * Wrap an authenticated API handler. Injects the current user, and converts
 * common errors (auth, validation, not-found) into proper HTTP responses so
 * individual handlers stay focused on the happy path.
 */
export function withUser<T extends unknown[]>(
  handler: (user: SessionUser, ...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      const user = await requireUser();
      return await handler(user, ...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiError("Not authenticated", 401);
      if (err instanceof ZodError) {
        return apiError("Please fix the highlighted fields", 422, { fields: fieldErrors(err) });
      }
      if (err instanceof NotFoundError) return apiError(err.message, 404);
      if (err instanceof ConflictError) return apiError(err.message, 409);
      // Prisma unique-constraint violation. This is the DB-level backstop for
      // the check-then-write races on (userId, name) — when two concurrent
      // requests both pass the app-level duplicate check, one create wins and
      // the loser lands here. Surface it as a clean 409 instead of a 500.
      if (isUniqueViolation(err)) return apiError("This already exists.", 409);
      console.error("[api] unhandled error:", err);
      return apiError("Something went wrong. Please try again.", 500);
    }
  };
}

/** True for a Prisma "unique constraint failed" error (code P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}
