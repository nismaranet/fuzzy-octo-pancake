import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import ThemeToggle from "./ThemeToggle";

export default async function Navbar() {
  const session = await getServerSession(authOptions);

  const menuItems = [
    { name: "Home", href: "/" },
    { name: "Events", href: "/events" },
    { name: "Jobs", href: "/jobs" },
    { name: "Special Contarct", href: "/special-contracts" },
  ];

  return (
    <header className="w-full border-b border-border/50 bg-background/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-linear-to-br from-primary to-accent-sky rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:block">
            Nismara
          </span>
        </Link>

        {/* Menu Tengah */}
        <nav className="hidden md:flex items-center gap-8">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors relative group"
            >
              {item.name}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full"></span>
            </Link>
          ))}
        </nav>

        {/* Bagian Kanan: Theme & Auth */}
        <div className="flex items-center gap-4">
          <ThemeToggle />

          <div className="h-6 w-[1] bg-border mx-1"></div>

          {session ? (
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold leading-none">
                  {session.user?.name}
                </p>
                <p className="text-[10px] text-primary leading-tight">
                  Dashboard
                </p>
              </div>
              <div className="w-9 h-9 rounded-full border-2 border-primary/30 group-hover:border-primary transition-all overflow-hidden bg-card">
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold bg-primary/10">
                    {session.user?.name?.charAt(0)}
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
            >
              Login Driver
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
