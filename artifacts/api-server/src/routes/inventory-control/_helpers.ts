/** inventory-control/_helpers.ts — shared schemas */
import { z } from 'zod/v4';

import { eq, and, inArray, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import { firstZodError } from '../lib/schemas';
import { resolveTenantWarehouseId } from '../lib/warehouse-guard';

const createCountSessionSchema = z.object({
  warehouse_id: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        physical_qty: z.number().finite(),
        notes: z.string().optional().nullable(),
      })
    )
    .min(1),
});

const createTransferSchema = z.object({
  from_warehouse_id: z.number().int().positive(),
  to_warehouse_id: z.number().int().positive(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
});
import {
  db,
  productsTable,
  stockMovementsTable,
  stockCountSessionsTable,
  stockCountItemsTable,
  warehousesTable,
} from '@workspace/db';
import { wrap } from '../lib/async-handler';
import { hasPermission } from '../lib/permissions';
