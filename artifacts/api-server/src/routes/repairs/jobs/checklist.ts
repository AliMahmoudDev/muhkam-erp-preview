/**
 * Repair configuration routes:
 *   GET/POST/PATCH/DELETE /repair-statuses
 *   GET/POST/PATCH/DELETE /repair-checklist-items
 *   POST /repair-checklist-items/seed-device-type
 *   POST /repair-checklist-items/copy
 *   POST /repair-checklist-items/reorder
 *   GET/POST/DELETE /repair-device-models
 */
import { Router, type IRouter } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import {
  db,
  repairStatusesTable,
  repairChecklistItemsTable,
  repairDeviceModelsTable,
} from '@workspace/db';
import { wrap } from '../../../lib/async-handler';
import { hasPermission } from '../../../lib/permissions';
import {
  ctx,
  ensureCompanyDefaults,
  VALID_DEVICE_TYPES,
  type DeviceType,
  SEED_TEMPLATES,
  createRepairStatusSchema,
  updateRepairStatusSchema,
  createChecklistItemSchema,
} from '../_shared';

const router: IRouter = Router();

/* ══════════════════════════════════════════════════════════════
   STATUSES
   ══════════════════════════════════════════════════════════════ */
router.get(
  '/repair-statuses',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    await ensureCompanyDefaults(company_id);
    const rows = await db
      .select()
      .from(repairStatusesTable)
      .where(eq(repairStatusesTable.company_id, company_id))
      .orderBy(repairStatusesTable.sort_order);
    return res.json(rows);
  })
);

router.post(
  '/repair-statuses',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const v = createRepairStatusSchema.safeParse(req.body);
    if (!v.success)
      return res.status(400).json({ error: v.error.errors[0]?.message ?? 'بيانات غير صالحة' });
    const { label_ar, key: rawKey, color, sort_order } = v.data;
    const key = rawKey ?? `custom_${Date.now()}`;
    const [row] = await db
      .insert(repairStatusesTable)
      .values({
        company_id,
        key,
        label_ar,
        color: color ?? '#64748b',
        sort_order: sort_order ?? 99,
        is_system: false,
      })
      .returning();
    return res.status(201).json(row);
  })
);

router.patch(
  '/repair-statuses/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const id = Number(req.params.id);
    const v = updateRepairStatusSchema.safeParse(req.body);
    if (!v.success)
      return res.status(400).json({ error: v.error.errors[0]?.message ?? 'بيانات غير صالحة' });
    const { label_ar, color, sort_order } = v.data;
    const updates: Record<string, unknown> = {};
    if (label_ar !== undefined) updates.label_ar = label_ar;
    if (color !== undefined) updates.color = color;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    const [row] = await db
      .update(repairStatusesTable)
      .set(updates)
      .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)))
      .returning();
    if (!row) return res.status(404).json({ error: 'غير موجود' });
    return res.json(row);
  })
);

router.delete(
  '/repair-statuses/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const id = Number(req.params.id);
    const [s] = await db
      .select()
      .from(repairStatusesTable)
      .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)));
    if (!s) return res.status(404).json({ error: 'غير موجود' });
    if (s.is_system) return res.status(400).json({ error: 'لا يمكن حذف حالة النظام' });
    await db
      .delete(repairStatusesTable)
      .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)));
    return res.json({ ok: true });
  })
);

/* ══════════════════════════════════════════════════════════════
   CHECKLIST ITEMS
   ══════════════════════════════════════════════════════════════ */
router.get(
  '/repair-checklist-items',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    await ensureCompanyDefaults(company_id);
    const deviceType = req.query.device_type as string | undefined;
    const where = deviceType
      ? and(
          eq(repairChecklistItemsTable.company_id, company_id),
          eq(repairChecklistItemsTable.device_type, deviceType)
        )
      : eq(repairChecklistItemsTable.company_id, company_id);
    const rows = await db
      .select()
      .from(repairChecklistItemsTable)
      .where(where)
      .orderBy(repairChecklistItemsTable.sort_order);
    return res.json(rows);
  })
);

router.post(
  '/repair-checklist-items',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const v = createChecklistItemSchema.safeParse(req.body);
    if (!v.success)
      return res.status(400).json({ error: v.error.errors[0]?.message ?? 'بيانات غير صالحة' });
    const { label_ar: label, device_type: rawDeviceType } = v.data;
    const b = req.body as Record<string, unknown>;
    const category = String(b.category ?? 'عام').trim() || 'عام';
    const device_type = rawDeviceType ?? (String(b.device_type ?? 'general').trim() || 'general');
    const existing = await db
      .select({ s: repairChecklistItemsTable.sort_order })
      .from(repairChecklistItemsTable)
      .where(
        and(
          eq(repairChecklistItemsTable.company_id, company_id),
          eq(repairChecklistItemsTable.category, category),
          eq(repairChecklistItemsTable.device_type, device_type)
        )
      )
      .orderBy(desc(repairChecklistItemsTable.sort_order))
      .limit(1);
    const nextOrder = (existing[0]?.s ?? 0) + 1;
    const [row] = await db
      .insert(repairChecklistItemsTable)
      .values({
        company_id,
        label_ar: label,
        category,
        device_type,
        sort_order: nextOrder,
        is_system: false,
      })
      .returning();
    return res.status(201).json(row);
  })
);

router.post(
  '/repair-checklist-items/seed-device-type',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const { device_type } = req.body as { device_type: string };
    // eslint-disable-next-line security/detect-object-injection
    const template = SEED_TEMPLATES[device_type];
    if (!template) return res.status(400).json({ error: 'device_type غير معروف' });

    const existing = await db
      .select({ id: repairChecklistItemsTable.id })
      .from(repairChecklistItemsTable)
      .where(
        and(
          eq(repairChecklistItemsTable.company_id, company_id),
          eq(repairChecklistItemsTable.device_type, device_type)
        )
      )
      .limit(1);
    if (existing.length > 0) return res.status(409).json({ error: 'already_seeded' });

    const catOrder: Record<string, number> = {};
    const rows = template.map((item) => {
      catOrder[item.category] = (catOrder[item.category] ?? 0) + 1;
      return {
        company_id,
        label_ar: item.label_ar,
        category: item.category,
        device_type,
        sort_order: catOrder[item.category],
        is_system: true,
      };
    });
    await db.insert(repairChecklistItemsTable).values(rows);
    return res.json({ ok: true, count: rows.length });
  })
);

router.post(
  '/repair-checklist-items/copy',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const { from, to } = req.body as { from: string; to: string };
    if (!from || !to || from === to) return res.status(400).json({ error: 'from/to invalid' });
    if (!VALID_DEVICE_TYPES.includes(to as DeviceType))
      return res.status(400).json({ error: 'to غير معروف' });

    const sourceItems = await db
      .select()
      .from(repairChecklistItemsTable)
      .where(
        and(
          eq(repairChecklistItemsTable.company_id, company_id),
          eq(repairChecklistItemsTable.device_type, from)
        )
      );
    if (sourceItems.length === 0)
      return res.status(404).json({ error: 'لا توجد بنود في النوع المصدر' });

    const existingTarget = await db
      .select({ id: repairChecklistItemsTable.id })
      .from(repairChecklistItemsTable)
      .where(
        and(
          eq(repairChecklistItemsTable.company_id, company_id),
          eq(repairChecklistItemsTable.device_type, to)
        )
      )
      .limit(1);
    if (existingTarget.length > 0) return res.status(409).json({ error: 'already_has_items' });

    const rows = sourceItems.map((s) => ({
      company_id,
      label_ar: s.label_ar,
      category: s.category ?? 'عام',
      device_type: to,
      sort_order: s.sort_order ?? 0,
      is_system: false,
    }));
    await db.insert(repairChecklistItemsTable).values(rows);
    return res.json({ ok: true, count: rows.length });
  })
);

router.patch(
  '/repair-checklist-items/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const id = Number(req.params.id);
    const b = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if ('label_ar' in b) updates.label_ar = String(b.label_ar);
    if ('sort_order' in b) updates.sort_order = Number(b.sort_order);
    if ('category' in b) updates.category = String(b.category).trim() || 'عام';
    if ('device_type' in b) updates.device_type = String(b.device_type).trim() || 'general';
    const [row] = await db
      .update(repairChecklistItemsTable)
      .set(updates)
      .where(
        and(
          eq(repairChecklistItemsTable.id, id),
          eq(repairChecklistItemsTable.company_id, company_id)
        )
      )
      .returning();
    if (!row) return res.status(404).json({ error: 'غير موجود' });
    return res.json(row);
  })
);

/* ── إزالة التكرار: يحذف البنود المكررة (نفس label_ar + category + device_type) ── */
router.post(
  '/repair-checklist-items/deduplicate',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const { device_type } = req.body as { device_type?: string };
    const where = device_type
      ? and(
          eq(repairChecklistItemsTable.company_id, company_id),
          eq(repairChecklistItemsTable.device_type, device_type)
        )
      : eq(repairChecklistItemsTable.company_id, company_id);
    const rows = await db
      .select()
      .from(repairChecklistItemsTable)
      .where(where)
      .orderBy(repairChecklistItemsTable.sort_order);
    const seen = new Map<string, number>();
    const toDelete: number[] = [];
    for (const r of rows) {
      const key = `${r.device_type}|${r.category}|${r.label_ar.trim().toLowerCase()}`;
      if (seen.has(key)) {
        toDelete.push(r.id);
      } else {
        seen.set(key, r.id);
      }
    }
    if (toDelete.length === 0) return res.json({ ok: true, deleted: 0 });
    await Promise.all(
      toDelete.map((id) =>
        db
          .delete(repairChecklistItemsTable)
          .where(
            and(
              eq(repairChecklistItemsTable.id, id),
              eq(repairChecklistItemsTable.company_id, company_id)
            )
          )
      )
    );
    return res.json({ ok: true, deleted: toDelete.length });
  })
);

/* ── دمج التصنيفات: يعيد تسمية category في جميع البنود ── */
router.post(
  '/repair-checklist-items/merge-categories',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const { device_type, from_category, to_category } = req.body as {
      device_type: string;
      from_category: string;
      to_category: string;
    };
    if (!device_type || !from_category || !to_category) {
      return res.status(400).json({ error: 'device_type, from_category, to_category مطلوبة' });
    }
    if (from_category === to_category) return res.status(400).json({ error: 'من = إلى' });
    const result = await db
      .update(repairChecklistItemsTable)
      .set({ category: to_category.trim() })
      .where(
        and(
          eq(repairChecklistItemsTable.company_id, company_id),
          eq(repairChecklistItemsTable.device_type, device_type),
          eq(repairChecklistItemsTable.category, from_category)
        )
      )
      .returning({ id: repairChecklistItemsTable.id });
    return res.json({ ok: true, updated: result.length });
  })
);

router.post(
  '/repair-checklist-items/reorder',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const items = req.body as { id: number; sort_order: number }[];
    if (!Array.isArray(items)) return res.status(400).json({ error: 'invalid' });
    await Promise.all(
      items.map(({ id, sort_order }) =>
        db
          .update(repairChecklistItemsTable)
          .set({ sort_order })
          .where(
            and(
              eq(repairChecklistItemsTable.id, id),
              eq(repairChecklistItemsTable.company_id, company_id)
            )
          )
      )
    );
    return res.json({ ok: true });
  })
);

router.delete(
  '/repair-checklist-items/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const id = Number(req.params.id);
    await db
      .delete(repairChecklistItemsTable)
      .where(
        and(
          eq(repairChecklistItemsTable.id, id),
          eq(repairChecklistItemsTable.company_id, company_id)
        )
      );
    return res.json({ ok: true });
  })
);

/* ══════════════════════════════════════════════════════════════
   REPAIR DEVICE MODELS
   ══════════════════════════════════════════════════════════════ */
router.get(
  '/repair-device-models',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const rows = await db
      .select()
      .from(repairDeviceModelsTable)
      .where(eq(repairDeviceModelsTable.company_id, company_id))
      .orderBy(
        repairDeviceModelsTable.brand,
        repairDeviceModelsTable.category,
        repairDeviceModelsTable.sort_order
      );
    return res.json(rows);
  })
);

router.post(
  '/repair-device-models',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const { brand, category, model } = req.body as {
      brand: string;
      category: string;
      model: string;
    };
    if (!brand?.trim() || !category?.trim() || !model?.trim()) {
      return res.status(400).json({ error: 'brand, category, model مطلوبة' });
    }
    const existing = await db
      .select({ s: repairDeviceModelsTable.sort_order })
      .from(repairDeviceModelsTable)
      .where(
        and(
          eq(repairDeviceModelsTable.company_id, company_id),
          eq(repairDeviceModelsTable.brand, brand.trim()),
          eq(repairDeviceModelsTable.category, category.trim())
        )
      )
      .orderBy(desc(repairDeviceModelsTable.sort_order))
      .limit(1);
    const nextOrder = (existing[0]?.s ?? -1) + 1;
    const [row] = await db
      .insert(repairDeviceModelsTable)
      .values({
        company_id,
        brand: brand.trim(),
        category: category.trim(),
        model: model.trim(),
        sort_order: nextOrder,
      })
      .returning();
    return res.status(201).json(row);
  })
);

router.delete(
  '/repair-device-models/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_repairs')) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { company_id } = ctx(req);
    const id = Number(req.params.id);
    await db
      .delete(repairDeviceModelsTable)
      .where(
        and(eq(repairDeviceModelsTable.id, id), eq(repairDeviceModelsTable.company_id, company_id))
      );
    return res.json({ ok: true });
  })
);

export default router;
