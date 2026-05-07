import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import NavbarClient from "@/components/NavbarClient";

export default async function Navbar() {
  const session = await getServerSession(authOptions);

  return <NavbarClient session={session} />;
}
