import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getScrapeIntervalHours, setSetting } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scrapeIntervalHours = await getScrapeIntervalHours();
  return NextResponse.json({ scrapeIntervalHours });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const hours = parseInt(body.scrapeIntervalHours, 10);
  if (!hours || hours < 1 || hours > 168)
    return NextResponse.json({ error: "Invalid interval (1–168 hours)" }, { status: 400 });

  await setSetting("scrape_interval_hours", String(hours));
  return NextResponse.json({ scrapeIntervalHours: hours });
}
