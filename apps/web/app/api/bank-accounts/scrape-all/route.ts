import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBankAccounts, createScrapeJob } from "@/lib/bankAccounts";
import { startScrapeJob } from "@/lib/scraper";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await getBankAccounts(session.user.id);
  const eligible = accounts.filter((a) => a.scrape_enabled && a.status !== "scraping");

  const jobs: { accountId: string; jobId: string }[] = [];

  for (const account of eligible) {
    const job = await createScrapeJob(session.user.id, account.id);
    startScrapeJob(
      job.id,
      session.user.id,
      account.id,
      account.company_id,
      account.credentials_encrypted,
    );
    jobs.push({ accountId: account.id, jobId: job.id });
  }

  return NextResponse.json({ jobs }, { status: 202 });
}
