/**
 * seedDefaults — runs once on server start.
 * 1. Creates the default company if the companies table is empty.
 * 2. Creates a super_admin user if none exists.
 * 3. Creates a default company_admin user for company 1 if none exists.
 * 4. Migrates any plain-text PINs to bcrypt hashes (one-time, idempotent).
 */
import { eq } from "drizzle-orm";
import { db, erpUsersTable, companiesTable } from "@workspace/db";
import { logger } from "./logger";
import { hashPin, isHashed } from "./hash";

export async function seedDefaults(): Promise<void> {
  try {
    /* ── 1. Ensure default company exists — capture its real ID ─── */
    let [defaultCompany] = await db
      .select({ id: companiesTable.id })
      .from(companiesTable)
      .limit(1);

    if (!defaultCompany) {
      const [inserted] = await db.insert(companiesTable).values({
        name:       "الشركة الافتراضية",
        plan_type:  "professional",
        edition:    "advanced",
        is_active:  true,
        start_date: new Date().toISOString().split("T")[0],
        end_date:   new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        features:   {
          accounting:          true,
          hr:                  true,
          pos:                 true,
          warranty:            true,
          consignment:         true,
          fixed_assets:        true,
          maintenance:         true,
          budgets:             true,
          bank_reconciliation: true,
        },
      }).returning({ id: companiesTable.id });
      defaultCompany = inserted;
      logger.info("Default company created");
    }

    const defaultCompanyId = defaultCompany.id;

    /* ── 2. Ensure super_admin user exists ─────────────────────── */
    const [superAdmin] = await db
      .select({ id: erpUsersTable.id })
      .from(erpUsersTable)
      .where(eq(erpUsersTable.role, "super_admin"))
      .limit(1);

    if (!superAdmin) {
      const superAdminPin = process.env.SUPER_ADMIN_PIN;
      if (!superAdminPin) {
        logger.warn("SUPER_ADMIN_PIN is not set — skipping super admin creation. Set the secret to create the account.");
      } else {
        const hashed = await hashPin(superAdminPin);
        await db.insert(erpUsersTable).values({
          name:       "Super Admin",
          username:   "superadmin",
          pin:        hashed,
          role:       "super_admin",
          company_id: null,
          active:     true,
        });
        logger.info("Super admin created — username: superadmin");
      }
    }

    /* ── 3. Ensure default company_admin exists & PIN is always in sync ── */
    const defaultAdminPin = process.env.DEFAULT_ADMIN_PIN;
    if (!defaultAdminPin) {
      logger.warn("DEFAULT_ADMIN_PIN is not set — skipping default admin management.");
    } else {
      const hashed = await hashPin(defaultAdminPin);

      /* Remove duplicate users per username within this company (keep lowest id) */
      const allAdmins = await db
        .select({ id: erpUsersTable.id, username: erpUsersTable.username })
        .from(erpUsersTable)
        .where(eq(erpUsersTable.company_id, defaultCompanyId));

      const usernameGroups: Record<string, number[]> = {};
      for (const u of allAdmins) {
        if (!usernameGroups[u.username]) usernameGroups[u.username] = [];
        usernameGroups[u.username].push(u.id);
      }
      for (const [uname, ids] of Object.entries(usernameGroups)) {
        if (ids.length > 1) {
          // Keep lowest id, delete the rest
          const [, ...deleteIds] = ids.sort((a, b) => a - b);
          for (const delId of deleteIds) {
            await db.delete(erpUsersTable).where(eq(erpUsersTable.id, delId));
          }
          logger.info({ uname, deleted: deleteIds.length }, "Removed duplicate users");
        }
      }

      /* Upsert the default admin — always keep PIN in sync with DEFAULT_ADMIN_PIN */
      const [existingAdmin] = await db
        .select({ id: erpUsersTable.id })
        .from(erpUsersTable)
        .where(eq(erpUsersTable.company_id, defaultCompanyId))
        .limit(1);

      if (!existingAdmin) {
        await db.insert(erpUsersTable).values({
          name:       "المدير الافتراضي",
          username:   "admin",
          pin:        hashed,
          role:       "admin",
          company_id: defaultCompanyId,
          active:     true,
        });
        logger.info(`Default company admin created — username: admin (company_id: ${defaultCompanyId})`);
      } else {
        await db
          .update(erpUsersTable)
          .set({ pin: hashed })
          .where(eq(erpUsersTable.id, existingAdmin.id));
        logger.info(`Default company admin PIN synced — id: ${existingAdmin.id}`);
      }
    }

    /* ── 4. Migrate plain-text PINs to bcrypt hashes ───────────── */
    await migratePlainTextPins();

  } catch (err) {
    logger.error({ err }, "seedDefaults failed — continuing without defaults");
  }
}

async function migratePlainTextPins(): Promise<void> {
  try {
    const users = await db
      .select({ id: erpUsersTable.id, pin: erpUsersTable.pin })
      .from(erpUsersTable);

    let migrated = 0;
    for (const user of users) {
      if (!user.pin) continue;
      if (isHashed(user.pin)) continue;

      const hashed = await hashPin(user.pin);
      await db
        .update(erpUsersTable)
        .set({ pin: hashed })
        .where(eq(erpUsersTable.id, user.id));
      migrated++;
    }

    if (migrated > 0) {
      logger.info({ migrated }, "Migrated plain-text PINs to bcrypt hashes");
    }
  } catch (err) {
    logger.error({ err }, "PIN migration failed — server will continue but PINs may be unhashed");
  }
}
