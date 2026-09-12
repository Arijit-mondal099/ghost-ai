import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth";
import { authAppearance } from "@/lib/auth-appearance";

function SignUpPage() {
  return (
    <AuthShell
      title="Get started"
      sub="Create your account and start designing with AI."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="rounded text-ai-text outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUp appearance={authAppearance} routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthShell>
  );
}

export default SignUpPage;
