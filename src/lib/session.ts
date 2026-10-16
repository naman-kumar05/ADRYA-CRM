import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./constants";

export type SessionPayload = {
  sub: string;
  role: Role;
  name: string;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role as Role,
      name: typeof payload.name === "string" ? payload.name : "",
    } satisfies SessionPayload;
  } catch {
    return null;
  }
}
