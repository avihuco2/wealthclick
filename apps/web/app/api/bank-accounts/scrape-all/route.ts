import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBankAccounts, createScrapeJob } from "@/lib/bankAccounts";
import { startScrapeJobSequential } from "@/lib/scraper";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await getBankAccounts(session.user.id);
  const eligible = accounts.filter((a) => a.scrape_enabled && a.status !== "scraping");

  const jobs: { accountId: string; jobId: string }[] = [];
  const jobQueue: { jobId: string; userId: string; bankAccountId: string; companyId: string; credentialsEncrypted: string }[] = [];

  for (const account of eligible) {
    const job = await createScrapeJob(session.user.id, account.id, "queued");
    jobs.push({ accountId: account.id, jobId: job.id });
    jobQueue.push({
      jobId: job.id,
      userId: session.user.id,
      bankAccountId: account.id,
      companyId: account.company_id,
      credentialsEncrypted: account.credentials_encrypted,
    });
  }

  // Run sequentially in background — one account at a time to avoid parallel Puppeteer load
  startScrapeJobSequential(jobQueue).catch((err) =>
    console.error("[scrape-all] sequential runner error:", err),
  );

  return NextResponse.json({ jobs }, { status: 202 });
}
