import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getParentAdminEnv, hasParentAdminPassword } from "@/lib/env";

const COOKIE_NAME = "okostankonyv_parent_session";

export async function POST(request: Request) {
  if (!hasParentAdminPassword()) {
    return NextResponse.json({ unlocked: true });
  }

  const { password } = (await request.json()) as { password?: string };
  const expectedPassword = getParentAdminEnv().password;

  if (!password || !expectedPassword || password !== expectedPassword) {
    return NextResponse.json({ error: "Hibás jelszó." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json({ unlocked: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ unlocked: false });
}

