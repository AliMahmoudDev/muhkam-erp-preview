/**
 * Employee Documents, Contacts, and Status History
 */
import { Router } from 'express';
import { eq, and, isNull, desc } from 'drizzle-orm';
import {
  db,
  employeesTable,
  employeeDocumentsTable,
  employeeContactsTable,
  employeeStatusHistoryTable,
} from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { fmtTs, requireHrAccess } from './helpers';
import { getTenant } from "../../middleware/auth";

const router = Router();

/* ═══ DOCUMENTS ══════════════════════════════════════════════════════ */

router.get('/employees/:id/documents', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_view_employees')) { res.status(403).json({ error: 'غير مصرح' }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params['id']), 10);
  const emp = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (emp.length === 0) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }
  const docs = await db.select().from(employeeDocumentsTable)
    .where(eq(employeeDocumentsTable.employee_id, id))
    .orderBy(desc(employeeDocumentsTable.created_at));
  res.json(docs.map((d) => ({ ...d, created_at: fmtTs(d.created_at), updated_at: fmtTs(d.updated_at), verified_at: fmtTs(d.verified_at) })));
}));

router.post('/employees/:id/documents', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_manage_employees')) { res.status(403).json({ error: 'غير مصرح' }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params['id']), 10);
  const { document_type, file_name, file_path, expiry_date, notes } = req.body as Record<string, string>;
  if (!document_type || !file_name) { res.status(400).json({ error: 'نوع المستند واسم الملف مطلوبان' }); return; }
  const emp = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (emp.length === 0) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }
  const [doc] = await db.insert(employeeDocumentsTable).values({
    employee_id: id, document_type, file_name,
    file_path: file_path ?? null, expiry_date: expiry_date ?? null, notes: notes ?? null,
  }).returning();
  res.status(201).json({ ...doc, created_at: fmtTs(doc.created_at), updated_at: fmtTs(doc.updated_at), verified_at: null });
}));

router.patch('/employees/:id/documents/:docId/verify', wrap(async (req, res) => {
  if (!requireHrAccess(req, res)) return;
  const companyId = getTenant(req);
  const userId    = req.user?.id ?? null;
  const id    = parseInt(String(req.params['id']), 10);
  const docId = parseInt(String(req.params['docId']), 10);
  const emp = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (emp.length === 0) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }
  const [doc] = await db.update(employeeDocumentsTable)
    .set({ verified_by: userId, verified_at: new Date() })
    .where(and(eq(employeeDocumentsTable.id, docId), eq(employeeDocumentsTable.employee_id, id)))
    .returning();
  if (!doc) { res.status(404).json({ error: 'المستند غير موجود' }); return; }
  res.json({ ok: true, verified_at: fmtTs(doc.verified_at) });
}));

router.delete('/employees/:id/documents/:docId', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_manage_employees')) { res.status(403).json({ error: 'غير مصرح' }); return; }
  const companyId = getTenant(req);
  const id    = parseInt(String(req.params['id']), 10);
  const docId = parseInt(String(req.params['docId']), 10);
  const emp = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (emp.length === 0) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }
  await db.delete(employeeDocumentsTable)
    .where(and(eq(employeeDocumentsTable.id, docId), eq(employeeDocumentsTable.employee_id, id)));
  res.json({ ok: true });
}));

/* ═══ CONTACTS ═══════════════════════════════════════════════════════ */

router.get('/employees/:id/contacts', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_view_employees')) { res.status(403).json({ error: 'غير مصرح' }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params['id']), 10);
  const emp = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (emp.length === 0) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }
  const contacts = await db.select().from(employeeContactsTable)
    .where(eq(employeeContactsTable.employee_id, id))
    .orderBy(employeeContactsTable.id);
  res.json(contacts.map((c) => ({ ...c, created_at: fmtTs(c.created_at) })));
}));

router.post('/employees/:id/contacts', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_manage_employees')) { res.status(403).json({ error: 'غير مصرح' }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params['id']), 10);
  const { contact_type, name, relationship, phone, email } = req.body as Record<string, string>;
  if (!name?.trim()) { res.status(400).json({ error: 'اسم جهة الاتصال مطلوب' }); return; }
  const emp = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (emp.length === 0) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }
  const [contact] = await db.insert(employeeContactsTable).values({
    employee_id: id,
    contact_type: contact_type ?? 'emergency',
    name: name.trim(),
    relationship: relationship ?? null,
    phone: phone ?? null,
    email: email ?? null,
  }).returning();
  res.status(201).json({ ...contact, created_at: fmtTs(contact.created_at) });
}));

router.delete('/employees/:id/contacts/:cid', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_manage_employees')) { res.status(403).json({ error: 'غير مصرح' }); return; }
  const id  = parseInt(String(req.params['id']), 10);
  const cid = parseInt(String(req.params['cid']), 10);
  await db.delete(employeeContactsTable)
    .where(and(eq(employeeContactsTable.id, cid), eq(employeeContactsTable.employee_id, id)));
  res.json({ ok: true });
}));

/* ═══ STATUS HISTORY ════════════════════════════════════════════════ */

router.get('/employees/:id/history', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_view_employees')) { res.status(403).json({ error: 'غير مصرح' }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params['id']), 10);
  const emp = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId)));
  if (emp.length === 0) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }
  const rows = await db.select().from(employeeStatusHistoryTable)
    .where(eq(employeeStatusHistoryTable.employee_id, id))
    .orderBy(desc(employeeStatusHistoryTable.changed_at));
  res.json(rows.map((h) => ({ ...h, changed_at: fmtTs(h.changed_at) })));
}));

export default router;
