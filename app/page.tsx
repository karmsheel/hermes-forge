import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSession } from "@/lib/auth";

/** App entry — welcome sign-in / sign-up for first launch */
export default async function WelcomePage() {
  const session = await getSession();
  if (session) redirect("/home");

  return (
    <Suspense>
      <AuthForm mode="login" welcome />
    </Suspense>
  );
}