import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteBankAccount } from "@/lib/bankAccounts";

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
