import { db, erpUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function run() {
  const pin = process.env.SUPER_ADMIN_PIN;
  if (!pin) {
    console.error("ERROR: SUPER_ADMIN_PIN not set");
    process.exit(1);
  }
  const hashed = await bcrypt.hash(pin, 12);
  const result = await db
    .update(erpUsersTable)
    .set({ pin: hashed, active: true })
    .where(eq(erpUsersTable.username, "superadmin"))
    .returning({ id: erpUsersTable.id, username: erpUsersTable.username });
  console.log("Updated:", JSON.stringify(result));
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
