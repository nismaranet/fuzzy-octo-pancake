"use client";

import React from "react";
import Link from "next/link";
import { Star, ShoppingBag } from "lucide-react";
import UserBadges from "@/components/icons/UserBadges";

export interface MarketUserInfo {
  discordId: string;
  name: string;
  image?: string | null;
  truckyId?: string | null;
  role?: string;
  truckyRank?: string;
  isBooster?: boolean;
  isNismaraPlus?: boolean;
  nismaraPlusStartedAt?: string | null;
  topManager?: {
    status?: boolean;
    month?: string | null;
    expiredAt?: string | null;
  } | null;
  sellerRating?: number;
  reviewCount?: number;
  totalSold?: number;
}

export default function MarketUserBadgeRow({
  user,
  showSellerStats = true,
  compact = false,
}: {
  user?: MarketUserInfo | null;
  showSellerStats?: boolean;
  compact?: boolean;
}) {
  const displayName = user?.name || "Driver Nismara";
  const profileHref = user?.truckyId ? `/profile/${user.truckyId}` : null;

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={`${
          compact ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm"
        } rounded-full bg-primary/15 border border-border/60 overflow-hidden shrink-0 flex items-center justify-center font-bold text-primary`}
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {profileHref ? (
            <Link
              href={profileHref}
              className={`${
                compact ? "text-xs" : "text-sm"
              } font-bold text-foreground hover:underline truncate max-w-[150px]`}
            >
              {displayName}
            </Link>
          ) : (
            <span
              className={`${
                compact ? "text-xs" : "text-sm"
              } font-bold text-foreground truncate max-w-[150px]`}
            >
              {displayName}
            </span>
          )}
          {user && (
            <span className="inline-flex items-center gap-1 shrink-0">
              <UserBadges
                role={user.role}
                topManager={user.topManager}
                isBooster={user.isBooster}
                isNismaraPlus={user.isNismaraPlus}
                nismaraPlusStartedAt={user.nismaraPlusStartedAt}
                truckyRank={user.truckyRank}
                className="w-3.5 h-3.5"
              />
            </span>
          )}
        </div>

        {showSellerStats && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            {user?.reviewCount && user.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                <Star className="w-3 h-3 fill-amber-400" />
                {user.sellerRating?.toFixed(1)}
                <span className="text-muted-foreground font-normal">
                  ({user.reviewCount})
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Belum ada ulasan</span>
            )}
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1">
              <ShoppingBag className="w-3 h-3" />
              {user?.totalSold || 0} terjual
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
