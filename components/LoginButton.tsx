"use client";

import { signIn } from "next-auth/react";
import { DiscordIcon } from "./icons/SocialMedia";
import Discord from "next-auth/providers/discord";

export default function LoginButton() {
  return (
    <button
      onClick={() => signIn("discord", { callbackUrl: "/" })}
      className="group relative flex w-full justify-center rounded-lg border border-[#7e57c2] bg-[#161b22] px-4 py-3 text-sm font-medium text-white transition-all hover:bg-[#7e57c2] focus:outline-none focus:ring-2 focus:ring-[#b39ddb] focus:ring-offset-2 focus:ring-offset-[#0d1117]"
    >
      <span className="flex items-center gap-2">
        {/* Simple Discord Icon Placeholder */}
        <DiscordIcon />
        Login with Discord
      </span>
    </button>
  );
}
