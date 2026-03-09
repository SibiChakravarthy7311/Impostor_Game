import { randomBytes } from "crypto";

export const SESSION_COOKIE_NAME = "ig_session";

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function getSessionTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  const item = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!item) return null;
  const [, value] = item.split("=");
  return value ?? null;
}
