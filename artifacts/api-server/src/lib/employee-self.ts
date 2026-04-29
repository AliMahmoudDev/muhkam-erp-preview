import type { Request } from "express";
import { hasPermission } from "./permissions";

/**
 * Self-service guard: returns the caller's employee_id when they should
 * only see their own data.
 *
 * Logic:
 * - User has an employee_id (any role)  → restrict to own data (return empId)
 * - No employee_id + can_view_employees → full access (return null)
 * - No employee_id + no permission      → deny (return -1)
 *
 * Callers treat:
 *   null → no filter (view all)
 *   empId → filter to that employee
 *   -1   → guaranteed empty / force 403
 */
export function selfEmployeeId(req: Request): number | null {
  // Any user linked to an employee → self-service mode
  if (req.user?.employee_id) return req.user.employee_id;
  // No employee_id: fall back to permission check
  if (hasPermission(req.user, "can_view_employees")) return null;
  // No employee_id, no permission → deny
  return -1;
}

/**
 * Returns true if the requested employee_id is accessible by this caller.
 */
export function canAccessEmployee(req: Request, employeeId: number | null | undefined): boolean {
  const self = selfEmployeeId(req);
  if (self === null) return true;
  if (self === -1) return false;
  return Number(employeeId) === self;
}

/**
 * Forbid write mutations when the caller has no manage permission.
 */
export function isSelfServiceUser(req: Request): boolean {
  return !hasPermission(req.user, "can_manage_employees");
}
