import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import type { Role } from "./constants";
import { can, type Action } from "./rbac";
import { signSession, verifySession } from "./session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  dealerId: string | null;
  vendorId: string | null;
};

const COOKIE = "adrya_session";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user?.active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    dealerId: user.dealerId,
    vendorId: user.vendorId,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAction(action: Action) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, action)) return null;
  return user;
}

export async function createSession(user: { id: string; role: Role; name: string }) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function requestIp() {
  const headerList = await headers();
  return headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || null;
}
