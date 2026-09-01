import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/editor");
  }

  redirect("/sign-in");
}

export default Home;
