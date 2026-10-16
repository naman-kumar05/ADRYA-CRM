"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function markNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
