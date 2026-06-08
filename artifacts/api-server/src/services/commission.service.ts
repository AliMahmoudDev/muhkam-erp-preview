/**
 * commission.service.ts
 * Phase 2 — حساب وقفل كوميشن الفنيين عند التسليم
 *
 * يُستدعى دائماً داخل نفس db.transaction() الخاصة بالتسليم
 * لضمان الذرية: إما التسليم + الكوميشن معاً أو لا شيء.
 */

import { eq, and, inArray } from "drizzle-orm";
import {
  repairJobServicesTable,
  repairJobServicePartsTable,
  repairJobPartsTable,
  repairServiceTypesTable,
} from "@workspace/db";

/** نوع الـ transaction المُمرَّر من db.transaction() */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

/* ── صيغ الحساب الثلاث ──────────────────────────────────────── */
function calcCommission(
  commissionType: string,
  commissionValue: number,
  serviceAmount: number,
  partsCost: number,
): number {
  switch (commissionType) {
    case "profit_based": {
      const profit = Math.max(0, serviceAmount - partsCost);
      return profit * (commissionValue / 100);
    }
    case "amount_based":
      return serviceAmount * (commissionValue / 100);
    case "fixed":
      return commissionValue;
    default:
      return 0;
  }
}

/**
 * يقفل ويحسب كوميشن جميع بنود الخدمة لبطاقة صيانة واحدة.
 * يُستدعى حصراً داخل transaction التسليم في crud.ts.
 *
 * @param jobId     - معرّف بطاقة الصيانة
 * @param companyId - معرّف الشركة
 * @param tx        - كائن الـ transaction الحالي
 */
export async function lockJobCommissions(
  jobId: number,
  companyId: number,
  tx: Tx,
): Promise<void> {
  /* 1. جلب جميع بنود الخدمة للبطاقة */
  const services = await tx
    .select()
    .from(repairJobServicesTable)
    .where(and(
      eq(repairJobServicesTable.job_id, jobId),
      eq(repairJobServicesTable.company_id, companyId),
    ));

  if (services.length === 0) return;

  const serviceIds = (services as { id: number }[]).map(s => s.id);

  /* 2. جلب تكاليف القطع المرتبطة (unit_price × quantity_allocated) */
  const linkedParts = await tx
    .select({
      service_id:         repairJobServicePartsTable.service_id,
      quantity_allocated: repairJobServicePartsTable.quantity_allocated,
      unit_price:         repairJobPartsTable.unit_price,
    })
    .from(repairJobServicePartsTable)
    .innerJoin(
      repairJobPartsTable,
      eq(repairJobPartsTable.id, repairJobServicePartsTable.part_id),
    )
    .where(inArray(repairJobServicePartsTable.service_id, serviceIds));

  /* map: service_id → parts_cost إجمالي */
  const partsCostByService = new Map<number, number>();
  for (const p of linkedParts as { service_id: number; unit_price: string; quantity_allocated: string }[]) {
    const cost = Number(p.unit_price) * Number(p.quantity_allocated);
    partsCostByService.set(
      p.service_id,
      (partsCostByService.get(p.service_id) ?? 0) + cost,
    );
  }

  /* 3. جلب أنواع الخدمات للبنود التي تملك service_type_id */
  const typeIds = [
    ...new Set(
      (services as { service_type_id: number | null }[])
        .map(s => s.service_type_id)
        .filter((id): id is number => id != null),
    ),
  ];
  const serviceTypes = typeIds.length > 0
    ? await tx
        .select()
        .from(repairServiceTypesTable)
        .where(inArray(repairServiceTypesTable.id, typeIds))
    : [];

  const typeById = new Map(
    (serviceTypes as { id: number; commission_type: string; commission_value: string }[])
      .map(t => [t.id, t]),
  );

  /* 4. حساب وقفل كل بند على حدة */
  for (const svc of services as {
    id: number;
    commission_locked: boolean;
    service_type_id: number | null;
    amount: string;
  }[]) {
    if (svc.commission_locked) continue; // مقفول مسبقاً — تجاوز

    const st = svc.service_type_id != null ? typeById.get(svc.service_type_id) : undefined;
    const commissionType  = st?.commission_type  ?? "profit_based";
    const commissionValue = Number(st?.commission_value ?? 0);
    const serviceAmount   = Number(svc.amount);
    const partsCost       = partsCostByService.get(svc.id) ?? 0;

    const computed = calcCommission(commissionType, commissionValue, serviceAmount, partsCost);

    /* snapshot نصي يوثّق مصدر الحساب للمراجعة المستقبلية */
    let sourceSnapshot: string;
    if (commissionType === "profit_based") {
      sourceSnapshot = `profit_based:(${serviceAmount}-${partsCost.toFixed(2)})×${commissionValue}%`;
    } else if (commissionType === "amount_based") {
      sourceSnapshot = `amount_based:${serviceAmount}×${commissionValue}%`;
    } else {
      sourceSnapshot = `fixed:${commissionValue}`;
    }

    await tx
      .update(repairJobServicesTable)
      .set({
        commission_source_snapshot: sourceSnapshot,
        commission_rate_snapshot:   String(commissionValue),
        commission_computed:        String(Number(computed.toFixed(2))),
        commission_locked:          true,
        updated_at:                 new Date(),
      })
      .where(eq(repairJobServicesTable.id, svc.id));
  }
}
