import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getScrapeJob } from "@/lib/bankAccounts";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await getScrapeJob(id);

  if (!job || job.user_id !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(job);
}
