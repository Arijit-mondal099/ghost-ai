import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth";
import { authAppearance } from "@/lib/auth-appearance";

function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      sub="Sign in and pick up where the canvas left off."
      footer={
        <>
          New to Ghost AI?{" "}
          <Link
            href="/sign-up"
            className="rounded text-ai-text outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
          >
            Sign up
          </Link>
        </>
      }
    >
      <SignIn appearance={authAppearance} routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </AuthShell>
  );
}

export default SignInPage;
