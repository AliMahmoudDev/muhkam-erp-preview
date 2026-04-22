import type { Request } from "express";

/**
 * Self-service guard for the `employee` role.
 * - If the authenticated user has role 'employee', they can ONLY access
 *   data tied to their own employee_id (linked via erp_users.employee_id).
 * - Returns the enforced employee_id for filtering, or null when no
 *   restriction applies (admin/manager/etc).
 */
export function selfEmployeeId(req: Request): number | null {
  if (req.user?.role !== "employee") return null;
  return req.user?.employee_id ?? -1;
}

/**
 * Returns true if the requested employee_id matches the self-service user,
 * OR the user is not in self-service mode (no restriction).
 */
export function canAccessEmployee(req: Request, employeeId: number | null | undefined): boolean {
  const self = selfEmployeeId(req);
  if (self === null) return true;
  return Number(employeeId) === self;
}

/**
 * Forbid any write/mutation when the caller is in self-service mode.
 */
export function isSelfServiceUser(req: Request): boolean {
  return req.user?.role === "employee";
}
