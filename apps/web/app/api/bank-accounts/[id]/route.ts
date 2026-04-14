import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteBankAccount, toggleBankAccountEnabled } from "@/lib/bankAccounts";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body.scrape_enabled !== "boolean")
    return NextResponse.json({ error: "Missing scrape_enabled boolean" }, { status: 400 });

  await toggleBankAccountEnabled(session.user.id, id, body.scrape_enabled);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteBankAccount(session.user.id, id);
  return new NextResponse(null, { status: 204 });
}
