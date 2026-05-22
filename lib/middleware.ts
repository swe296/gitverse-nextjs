import { NextRequest } from "next/server";
import { verifyToken, JWTPayload } from "./auth";
import { getToken } from "next-auth/jwt";

export interface AuthenticatedRequest {
  user: JWTPayload;
}

export async function getAuthUser(
  request: NextRequest
): Promise<JWTPayload | null> {
  try {
    const authHeader = request.headers.get("authorization");

    // 1) Existing JWT auth (Authorization: Bearer ...)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token) {
        const payload = verifyToken(token);
        if (payload && typeof payload.userId === "number" && payload.userId > 0) {
          return payload;
        }
      }
    }

    // 2) NextAuth session cookie (Google OAuth)
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    if (!token?.sub || !token.email) return null;

    const userId = Number(token.sub);
    if (!Number.isFinite(userId) || userId <= 0) return null;

    return { userId, email: token.email };
  } catch (error) {
    // Safely return null on any error without logging sensitive information
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const user = await getAuthUser(request);

  if (!user || !user.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  return user;
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as any).status === "number"
  );
}
