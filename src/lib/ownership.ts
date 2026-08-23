import "server-only";
import { prisma } from "./db";
import { NotFoundError } from "./api";

/**
 * Foreign-key ownership guards.
 *
 * SECURITY: any id that arrives from a client MUST be checked here before it is
 * written to the database. Without this, a user can create their own rows that
 * reference another user's account/category — which both leaks money into the
 * wrong balance and (via `onDelete: Cascade`) lets the other user's delete
 * silently destroy those rows.
 *
 * Every function throws NotFoundError (404) rather than a distinguishable
 * "forbidden", so these guards never confirm that someone else's id exists.
 */

/** Assert every non-null account id belongs to the user. */
export async function assertAccountsOwned(
  userId: string,
  ids: (string | null | undefined)[],
): Promise<void> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (wanted.length === 0) return;
  const found = await prisma.account.findMany({
    where: { id: { in: wanted }, userId },
    select: { id: true },
  });
  if (found.length !== wanted.length) throw new NotFoundError("Account not found");
}

/** Assert every non-null category id belongs to the user. */
export async function assertCategoriesOwned(
  userId: string,
  ids: (string | null | undefined)[],
): Promise<void> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (wanted.length === 0) return;
  const found = await prisma.category.findMany({
    where: { id: { in: wanted }, userId },
    select: { id: true },
  });
  if (found.length !== wanted.length) throw new NotFoundError("Category not found");
}

/**
 * Resolve an optional account id, returning null when absent and throwing when
 * it belongs to somebody else. Convenience for nullable single-id fields.
 */
export async function resolveOwnedAccountId(
  userId: string,
  id: string | null | undefined,
): Promise<string | null> {
  if (!id) return null;
  await assertAccountsOwned(userId, [id]);
  return id;
}
