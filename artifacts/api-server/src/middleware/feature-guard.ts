/**
 * feature-guard.ts
 *
 * Middleware factory that enforces company feature flags on API routes.
 *
 * Usage (at the top of a feature-specific router):
 *   router.use(requireFeature('accounting'));
 *
 * Behaviour:
 *  - Super admins always bypass the check.
 *  - If a company has no features row yet (null), we fall back to
 *    edition-based defaults so legacy companies are not accidentally blocked.
 *  - If the feature flag is explicitly `false` → 403 FEATURE_DISABLED.
 *  - On any DB error → fail open (request is allowed) to avoid a DB blip
 *    taking down the whole tenant.
 *
 * Cache: company features are cached in-process for 60 seconds (same TTL
 * used by tenant-guard) to avoid a DB hit on every API call.
 */

import type { Request, Response, NextFunction } from "express";
import { db, companiesTable, type CompanyFeatures, DEFAULT_FEATURES_ULTIMATE, DEFAULT_FEATURES_ADVANCED } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

/* ── In-process feature cache ─────────────────────────────────── */
interface CacheEntry {
  expiresAt: number;
  features: CompanyFeatures;
}

const cache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 1 minute

async function getFeatures(companyId: number): Promise<CompanyFeatures | null> {
  const now = Date.now();
  const hit = cache.get(companyId);
  if (hit && hit.expiresAt > now) return hit.features;

  try {
    const [row] = await db
      .select({ features: companiesTable.features, edition: companiesTable.edition })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId));

    if (!row) return null;

    const defaults = row.edition === "advanced"
      ? DEFAULT_FEATURES_ADVANCED
      : DEFAULT_FEATURES_ULTIMATE;

    const features: CompanyFeatures = row.features
      ? { ...defaults, ...row.features }
      : { ...defaults };

    cache.set(companyId, { expiresAt: now + CACHE_TTL_MS, features });
    return features;
  } catch {
    return null; // DB error → fail open
  }
}

/** Call this after updating company features to bust the local cache. */
export function invalidateFeatureCache(companyId: number): void {
  cache.delete(companyId);
}

/**
 * Returns an Express middleware that blocks requests when the given feature
 * flag is explicitly disabled for the requesting company.
 */
export function requireFeature(feature: keyof CompanyFeatures) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;

    // No user context, or super_admin → pass through
    if (!user || user.role === "super_admin") { next(); return; }

    // Users without a company assignment → pass through (let other guards handle it)
    if (!user.company_id) { next(); return; }

    try {
      const features = await getFeatures(user.company_id);

      // No features record (e.g. company not found) → fail open
      if (!features) { next(); return; }

      if (features[feature] === false) {
        logger.warn(
          { companyId: user.company_id, feature, path: req.path, method: req.method },
          "[FeatureGuard] Blocked — feature disabled"
        );
        res.status(403).json({
          error: "هذه الوحدة غير مفعّلة في اشتراكك الحالي. تواصل مع الدعم لتفعيلها.",
          code: "FEATURE_DISABLED",
          feature,
        });
        return;
      }

      next();
    } catch (err) {
      logger.error({ err, companyId: user.company_id, feature }, "[FeatureGuard] Error — failing open");
      next();
    }
  };
}
