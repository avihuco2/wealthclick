import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteBankAccount, toggleBankAccountEnabled, updateIgnoredDescriptions } from "@/lib/bankAccounts";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.scrape_enabled === "boolean") {
    await toggleBankAccountEnabled(session.user.id, id, body.scrape_enabled);
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(body.ignored_descriptions)) {
    const list = body.ignored_descriptions
      .filter((s: unknown): s is string => typeof s === "string")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
    await updateIgnoredDescriptions(session.user.id, id, list);
    return NextResponse.json({ ok: true, ignored_descriptions: list });
  }

  return NextResponse.json({ error: "Missing scrape_enabled or ignored_descriptions" }, { status: 400 });
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
