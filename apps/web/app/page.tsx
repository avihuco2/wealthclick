import { redirect } from "next/navigation";

// Root redirects to login — proxy.ts handles sending
// authenticated users straight to /dashboard
export default function Home() {
  redirect("/login");
}
