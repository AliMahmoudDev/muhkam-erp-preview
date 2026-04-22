/**
 * notify.ts — In-app notification helpers.
 * Notifications are stored per user_id. We resolve employee_id → user_id when needed.
 * All errors are swallowed so business operations never fail because of a notification.
 */
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, notificationsTable, erpUsersTable } from "@workspace/db";

export interface NotifyPayload {
  type: string;
  title: string;
  message: string;
  link?: string | null;
  reference_id?: number | null;
}

/** Insert a notification row for a single user. */
export async function notifyUser(companyId: number, userId: number, p: NotifyPayload): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      company_id: companyId,
      user_id: userId,
      type: p.type,
      title: p.title,
      message: p.message,
      link: p.link ?? null,
      reference_id: p.reference_id ?? null,
    });
  } catch (e) {
    // Silent — notifications are best-effort
    console.warn("[notify] failed for user", userId, e);
  }
}

/** Notify the user(s) linked to a specific employee record. Usually 0 or 1 user. */
export async function notifyEmployee(companyId: number, employeeId: number, p: NotifyPayload): Promise<void> {
  try {
    const users = await db.select({ id: erpUsersTable.id }).from(erpUsersTable)
      .where(and(eq(erpUsersTable.employee_id, employeeId), eq(erpUsersTable.company_id, companyId)));
    if (users.length === 0) return;
    await db.insert(notificationsTable).values(
      users.map(u => ({
        company_id: companyId,
        user_id: u.id,
        type: p.type,
        title: p.title,
        message: p.message,
        link: p.link ?? null,
        reference_id: p.reference_id ?? null,
      })),
    );
  } catch (e) {
    console.warn("[notify] failed for employee", employeeId, e);
  }
}

/**
 * Notify every user in the company that has a given JSON permission key set to true,
 * OR whose role is one of the privileged roles (admin/super_admin/manager).
 * Used to alert managers about new pending requests.
 */
export async function notifyManagers(companyId: number, permissionKey: string, p: NotifyPayload): Promise<void> {
  try {
    const rows = await db.execute(sql`
      SELECT id FROM erp_users
      WHERE company_id = ${companyId}
        AND active = true
        AND (
          role IN ('admin','super_admin','manager')
          OR (permissions::jsonb ->> ${permissionKey}::text)::boolean = true
        )
    `);
    const userIds: number[] = ((rows as any).rows ?? rows).map((r: any) => r.id);
    if (userIds.length === 0) return;
    await db.insert(notificationsTable).values(
      userIds.map(id => ({
        company_id: companyId,
        user_id: id,
        type: p.type,
        title: p.title,
        message: p.message,
        link: p.link ?? null,
        reference_id: p.reference_id ?? null,
      })),
    );
  } catch (e) {
    console.warn("[notify] failed for managers", e);
  }
}
