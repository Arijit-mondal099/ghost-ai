import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth";
import { authAppearance } from "@/lib/auth-appearance";

function SignUpPage() {
  return (
    <AuthShell>
      <SignUp appearance={authAppearance} routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthShell>
  );
}

export default SignUpPage;
