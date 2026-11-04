"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, AUTH_MAX_AGE, expectedToken, hashToken, safeNextPath, sameToken } from "@/lib/auth";

export type LoginState = { error?: string };

/** Form action for /login. On success sets the auth cookie and goes back to where the user was headed. */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const expected = await expectedToken();
  if (!expected) return { error: "APP_PASSWORD isn't set on the server." };

  const password = formData.get("password");
  if (typeof password !== "string" || !password) return { error: "Enter the password." };

  const token = await hashToken(password);
  if (!sameToken(token, expected)) return { error: "That password isn't right." };

  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true, // page JavaScript can't read it
    secure: process.env.NODE_ENV === "production", // https only once deployed
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });

  redirect(safeNextPath(formData.get("next")));
}
