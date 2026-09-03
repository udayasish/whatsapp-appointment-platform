// src/lib/jwt.ts
import "dotenv/config";
import { SignJWT, jwtVerify } from "jose";
import type { AdminUser } from "./db/models/admin-users.js";

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "clinicconnect-access-token-secret-dev-32chars";
const ACCESS_TOKEN_EXPIRATION = process.env.ACCESS_TOKEN_EXPIRATION || "7d";

const encoder = new TextEncoder();
const secretKey = encoder.encode(ACCESS_TOKEN_SECRET);

export type JwtPayload = {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
};

export const generateAccessToken = async (
  user: Pick<AdminUser, "id" | "email" | "role" | "tenantId">
): Promise<string> => {
  const jwt = await new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRATION)
    .sign(secretKey);

  return jwt;
};

export const verifyAccessToken = async (token: string): Promise<JwtPayload> => {
  const { payload } = await jwtVerify<JwtPayload>(token, secretKey);
  return payload;
};
