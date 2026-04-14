import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBankAccount, createScrapeJob } from "@/lib/bankAccounts";
import { startScrapeJob } from "@/lib/scraper";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const account = await getBankAccount(session.user.id, id);
  if (!account)
    return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const job = await createScrapeJob(session.user.id, id);

  // Fire-and-forget — safe on EC2 persistent Node.js process
  startScrapeJob(
    job.id,
    session.user.id,
    id,
    account.company_id,
    account.credentials_encrypted,
  );

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
