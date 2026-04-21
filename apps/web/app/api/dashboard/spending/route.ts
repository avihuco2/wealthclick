import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCategoryBreakdown } from "@/lib/insights";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month — expected YYYY-MM" }, { status: 400 });
  }

  const data = await getCategoryBreakdown(session.user.id, month);
  return NextResponse.json(data);
}
