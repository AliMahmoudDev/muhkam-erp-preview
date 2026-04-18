/**
 * refresh-token-store.ts
 *
 * Manages refresh token rotation.
 * - Each token is SHA-256 hashed before storage.
 * - On use: token is marked `used` immediately → prevents replay attacks.
 * - On logout: token is revoked.
 * - Expired tokens are cleaned up periodically.
 */

import crypto from "crypto";
import { db, refreshTokensTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "./logger";

const REFRESH_TTL_DAYS = 7;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function storeRefreshToken(token: string, userId: number): Promise<void> {
  const hash = hashToken(token);
  const expires = new Date();
  expires.setDate(expires.getDate() + REFRESH_TTL_DAYS);
  try {
    await db.insert(refreshTokensTable).values({ token_hash: hash, user_id: userId, expires_at: expires });
  } catch (err) {
    logger.error({ err }, "[refresh-token] failed to store token");
  }
}

export async function consumeRefreshToken(token: string): Promise<{ userId: number } | null> {
  const hash = hashToken(token);
  const now = new Date();
  const [row] = await db
    .select()
    .from(refreshTokensTable)
    .where(and(
      eq(refreshTokensTable.token_hash, hash),
      eq(refreshTokensTable.used, false),
      eq(refreshTokensTable.revoked, false),
    ))
    .limit(1);

  if (!row) return null;
  if (row.expires_at < now) {
    await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.id, row.id));
    return null;
  }

  await db
    .update(refreshTokensTable)
    .set({ used: true, used_at: now })
    .where(eq(refreshTokensTable.id, row.id));

  return { userId: row.user_id };
}

export async function revokeUserRefreshTokens(userId: number): Promise<void> {
  try {
    await db
      .update(refreshTokensTable)
      .set({ revoked: true })
      .where(and(eq(refreshTokensTable.user_id, userId), eq(refreshTokensTable.revoked, false)));
  } catch (err) {
    logger.error({ err }, "[refresh-token] failed to revoke tokens for user");
  }
}

export async function purgeExpiredRefreshTokens(): Promise<void> {
  try {
    await db.delete(refreshTokensTable).where(lt(refreshTokensTable.expires_at, new Date()));
  } catch (err) {
    logger.error({ err }, "[refresh-token] purge failed");
  }
}
