import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** App entry — marketing lives on the separate website/ project */
export default async function AppEntry() {
  const session = await getSession();
  redirect(session ? "/projects" : "/login");
}