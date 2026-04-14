import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBankAccounts, createBankAccount, getLatestScrapeJob } from "@/lib/bankAccounts";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await getBankAccounts(session.user.id);

  const accountsWithJobs = await Promise.all(
    accounts.map(async (account) => {
      const latestJob = await getLatestScrapeJob(account.id);
      const { credentials_encrypted: _creds, ...safe } = account;
      void _creds;
      return { ...safe, latestJob: latestJob ?? null };
    }),
  );

  return NextResponse.json(accountsWithJobs);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { companyId?: string; credentials?: Record<string, string>; nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { companyId, credentials, nickname } = body;
  if (!companyId || !credentials || typeof credentials !== "object")
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const credentialsEncrypted = encrypt(JSON.stringify(credentials));
  const account = await createBankAccount(
    session.user.id,
    companyId,
    credentialsEncrypted,
    nickname,
  );

  const { credentials_encrypted: _creds, ...safe } = account;
  void _creds;
  return NextResponse.json(safe, { status: 201 });
}
