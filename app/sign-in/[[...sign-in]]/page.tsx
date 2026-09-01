import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth";
import { authAppearance } from "@/lib/auth-appearance";

function SignInPage() {
  return (
    <AuthShell>
      <SignIn appearance={authAppearance} routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </AuthShell>
  );
}

export default SignInPage;
