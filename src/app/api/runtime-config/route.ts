import { connection } from "next/server";
import { NextResponse } from "next/server";

import { getRuntimePublicConfigScript } from "@/lib/robot-inspection/runtime-config.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  await connection();

  return new NextResponse(getRuntimePublicConfigScript(), {
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
      "Content-Type": "application/javascript; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
