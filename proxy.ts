import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes match the env vars that drive Clerk's sign-in/sign-up URLs
// (NEXT_PUBLIC_CLERK_SIGN_IN_URL, NEXT_PUBLIC_CLERK_SIGN_UP_URL). Keeping
// the route patterns aligned with those env values gives a single source
// of truth.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return;
  }

  // Default-deny: every other route requires a signed-in user.
  await auth.protect();
});

export const config = {
  matcher: [
    // Run on every route except Next.js internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Always run on API/TRPC routes.
    "/(api|trpc)(.*)",
  ],
};
