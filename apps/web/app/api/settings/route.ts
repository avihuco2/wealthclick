import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getScrapeIntervalHours, getScrapeHistoryMonths, setSetting } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [scrapeIntervalHours, scrapeHistoryMonths] = await Promise.all([
    getScrapeIntervalHours(),
    getScrapeHistoryMonths(),
  ]);
  return NextResponse.json({ scrapeIntervalHours, scrapeHistoryMonths });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if ("scrapeIntervalHours" in body) {
    const hours = parseInt(body.scrapeIntervalHours, 10);
    if (!hours || hours < 1 || hours > 168)
      return NextResponse.json({ error: "Invalid interval (1–168 hours)" }, { status: 400 });
    await setSetting("scrape_interval_hours", String(hours));
    return NextResponse.json({ scrapeIntervalHours: hours });
  }

  if ("scrapeHistoryMonths" in body) {
    const months = parseInt(body.scrapeHistoryMonths, 10);
    if (!months || months < 1 || months > 24)
      return NextResponse.json({ error: "Invalid period (1–24 months)" }, { status: 400 });
    await setSetting("scrape_history_months", String(months));
    return NextResponse.json({ scrapeHistoryMonths: months });
  }

  return NextResponse.json({ error: "No valid setting provided" }, { status: 400 });
}
