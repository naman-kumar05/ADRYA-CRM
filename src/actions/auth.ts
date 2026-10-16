"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, clearSession, requestIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "@/lib/form-state";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };
  if (!rateLimit(`login:${email}`, 8, 10 * 60 * 1000)) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = !!user && user.active && (await bcrypt.compare(password, user.passwordHash));
  await prisma.loginHistory.create({
    data: { userId: user?.id, email, success: ok, ip: await requestIp() },
  });
  if (!ok || !user) return { error: "Invalid email or password." };

  await createSession(user);
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
