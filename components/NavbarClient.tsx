"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "@/components/ui/NotificationBell";
import DecoratedAvatar from "@/components/profile/DecoratedAvatar";
import UserBadges from "@/components/icons/UserBadges";
import { getCurrencyData } from "@/app/dashboard/currency/actions";
import {
  getSeasonPassSummary,
  type SeasonPassSummary,
} from "@/app/dashboard/season-pass/actions";
import { NismaraIcon, DiscordIcon } from "./icons/SocialMedia";
import {
  Menu,
  LayoutDashboard,
  User,
  LogOut,
  ExternalLink,
  Home,
  Calendar,
  CalendarDays,
  Briefcase,
  Truck,
  Users,
  Trophy,
  Medal,
  TrendingUp,
  FileSignature,
  ClipboardList,
  Ticket,
  Heart,
  Grid3X3,
  ShoppingCart,
  Gamepad2,
  Package,
  Fuel,
  Sparkles,
  FileText,
  Shield,
  User2,
  Sparkle,
  TruckIcon,
  Target,
  Gift,
  Coins,
  Bus,
  BarChart3,
  Store,
  Settings,
  ArrowUpRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function NavbarClient({
  session,
  isSeasonPassEnabled = true,
}: {
  session: any;
  isSeasonPassEnabled?: boolean;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currency, setCurrency] = useState<number | null>(null);
  const [seasonPass, setSeasonPass] = useState<SeasonPassSummary | null>(null);

  // Note: If you need to close the menu on route change, you would normally use usePathname from next/navigation.
  // We'll keep the state simple for now without breaking existing code.

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && session?.user?.discordId) {
      getCurrencyData()
        .then((data) => setCurrency(data.balance))
        .catch((err) => console.error("Gagal mengambil currency:", err));

      if (isSeasonPassEnabled) {
        getSeasonPassSummary()
          .then((data) => setSeasonPass(data))
          .catch((err) => console.error("Gagal mengambil season pass:", err));
      } else {
        setSeasonPass(null);
      }
    }
  }, [mounted, session, isSeasonPassEnabled]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const effectiveIsScrolled = isScrolled && !isDashboard;

  // Standard top-level items (excluding Home, Jobs, Events, Community, Market which are custom handled)
  const mainMenuItems = [
    { name: "Convoy", href: "/convoy", icon: Truck },
    { name: "TimeZone", href: "/timezone", icon: Gamepad2 },
  ];

  // Mobile-specific menu items (flattened)
  const rawMobileMenuItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Season Pass", href: "/dashboard/season-pass", icon: Trophy },
    { name: "Jobs Details", href: "/jobs", icon: Briefcase },
    { name: "Coach Terminal", href: "/coach-terminal", icon: Bus },
    { name: "Cargo Market", href: "/cargo-market", icon: Package },
    { name: "Convoy", href: "/convoy", icon: Truck },
    { name: "Mod Workshop", href: "/market", icon: ShoppingCart, separator: true },
    { name: "Community Market", href: "/community-market", icon: Store },
    { name: "Fuel Market", href: "/fuel-market", icon: Fuel },
    { name: "Feeds", href: "/feeds", icon: Grid3X3, separator: true },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { name: "Statistics", href: "/statistics", icon: BarChart3 },
    { name: "Achievements", href: "/achievements", icon: Medal },
    { name: "Community Goals", href: "/community-goals", icon: Target },
    { name: "Giveaways", href: "/giveaways", icon: Gift },
    { name: "TimeZone", href: "/timezone", icon: Gamepad2, separator: true },
    {
      name: "Community Calendar",
      href: "/calendar",
      separator: true,
      icon: CalendarDays,
    },
    {
      name: "Currency Boost",
      href: "/currency-boost",
      icon: TrendingUp,
    },
    {
      name: "Special Contract",
      href: "/special-contracts",
      icon: FileSignature,
    },
    { name: "Surveys", href: "/surveys", icon: ClipboardList },
    { name: "Coupons", href: "/coupons", icon: Ticket },
  ];

  const mobileMenuItems = isSeasonPassEnabled
    ? rawMobileMenuItems
    : rawMobileMenuItems.filter((item) => item.href !== "/dashboard/season-pass");

  return (
    <>
      {/* Spacer to maintain document flow since header is fixed */}
      <div className="h-20 w-full shrink-0" />

      <header
        className={`fixed left-0 right-0 z-50 flex justify-center pointer-events-none transition-all duration-500 ease-out ${effectiveIsScrolled ? "top-4 px-4" : "top-0 px-0"}`}
      >
        <div
          className={`flex items-center justify-between pointer-events-auto transition-all duration-500 ease-out ${
            effectiveIsScrolled
              ? "w-max max-w-full rounded-full border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl h-16 px-4 sm:px-6 gap-8 xl:gap-16"
              : "w-full max-w-full rounded-none border-b border-border/20 bg-background/50 backdrop-blur-md h-20 px-4 sm:px-8 xl:px-12"
          }`}
        >
          {/* LOGO & DESKTOP NAV */}
          <div className="flex items-center gap-6 xl:gap-8">
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <div className="w-8 h-8 bg-linear-to-br from-primary to-accent-sky rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <NismaraIcon className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight uppercase">
                Nismara{" "}
                <span className="text-accent-sky hidden sm:inline">
                  Transport
                </span>
              </span>
            </Link>

            <div className="hidden xl:flex items-center">
              <NavigationMenu>
                <NavigationMenuList className="gap-1">
                  {/* Home */}
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      render={<Link href="/" />}
                      className={navigationMenuTriggerStyle()}
                    >
                      <Home className="mr-2 h-4 w-4 text-muted-foreground" />
                      Home
                    </NavigationMenuLink>
                  </NavigationMenuItem>

                  {/* Jobs Mega Menu */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="bg-transparent hover:bg-muted/50 data-[state=open]:bg-muted/50">
                      <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                      Jobs
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-[560px] p-5">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                          <div className="p-1.5 rounded-lg bg-sky-500/15">
                            <Briefcase className="w-4 h-4 text-sky-400" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-sky-400">Jobs &amp; Operations</p>
                            <p className="text-[11px] text-muted-foreground">Operasional pengiriman, bus, dan peluang kargo terbaik</p>
                          </div>
                        </div>
                        {/* Items */}
                        <ul className="grid grid-cols-1 gap-1">
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/jobs" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center group-hover/item:bg-sky-500/20 transition-colors">
                                <Briefcase className="w-4 h-4 text-sky-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">Jobs Details</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Riwayat pekerjaan seluruh driver Nismara Transport</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/coach-terminal" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover/item:bg-emerald-500/20 transition-colors">
                                <Bus className="w-4 h-4 text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">
                                  Coach Terminal{" "}
                                  <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                                    New
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  Papan keberangkatan bus, tarif penumpang & riwayat Coaches
                                </p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/cargo-market" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center group-hover/item:bg-orange-500/20 transition-colors">
                                <Package className="w-4 h-4 text-orange-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">Cargo Market</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Pasar kargo dan logistik terbaik dari komunitas</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                        </ul>
                        {/* Footer CTA */}
                        <div className="mt-4 pt-3 border-t border-border/50">
                          <NavigationMenuLink
                            render={<Link href="/jobs" />}
                            className="flex items-center justify-between px-3 py-2 rounded-xl bg-sky-500/8 hover:bg-sky-500/15 border border-sky-500/20 hover:border-sky-500/40 transition-all group/cta"
                          >
                            <span className="text-xs font-bold text-sky-400">Lihat semua riwayat job driver →</span>
                          </NavigationMenuLink>
                        </div>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {/* Events Mega Menu */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="bg-transparent hover:bg-muted/50 data-[state=open]:bg-muted/50">
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      Events
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-[640px] p-5">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                          <div className="p-1.5 rounded-lg bg-primary/15">
                            <Calendar className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-primary">Events & Program</p>
                            <p className="text-[11px] text-muted-foreground">Kegiatan, misi, dan reward eksklusif komunitas</p>
                          </div>
                        </div>
                        {/* Featured: Calendar */}
                        <NavigationMenuLink
                          render={<Link href="/calendar" />}
                          className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-primary/8 border border-primary/20 hover:bg-primary/15 hover:border-primary/40 transition-all group/feat"
                        >
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                            <CalendarDays className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-foreground leading-tight">Community Calendar <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">Featured</span></p>
                            <p className="text-xs text-muted-foreground mt-0.5">Jadwal lengkap seluruh kegiatan, promo, dan konvoi rutin komunitas</p>
                          </div>
                        </NavigationMenuLink>
                        {/* Grid items */}
                        <ul className="grid grid-cols-2 gap-1">
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/currency-boost" />}
                              className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover/item:bg-emerald-500/20 transition-colors">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground leading-tight">Currency Boost</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">Tingkatkan pendapatan NC selama event</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/special-contracts" />}
                              className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover/item:bg-violet-500/20 transition-colors">
                                <FileSignature className="w-3.5 h-3.5 text-violet-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground leading-tight">Special Contract</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">Kontrak khusus berhadiah eksklusif</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/surveys" />}
                              className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover/item:bg-blue-500/20 transition-colors">
                                <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground leading-tight">Surveys</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">Ikuti survey, dapatkan imbalan NC</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/coupons" />}
                              className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center group-hover/item:bg-rose-500/20 transition-colors">
                                <Ticket className="w-3.5 h-3.5 text-rose-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground leading-tight">Coupons</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">Kupon spesial untuk diskon atau hadiah</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/giveaways" />}
                              className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/60 transition-all group/item col-span-2"
                            >
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover/item:bg-amber-500/20 transition-colors">
                                <Gift className="w-3.5 h-3.5 text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground leading-tight">Giveaways <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full">New</span></p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">Event undian berhadiah spektakuler bagi seluruh driver</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                        </ul>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {/* Community Mega Menu */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="bg-transparent hover:bg-muted/50 data-[state=open]:bg-muted/50">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      Community
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-[580px] p-5">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                          <div className="p-1.5 rounded-lg bg-indigo-500/15">
                            <Users className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-400">Komunitas</p>
                            <p className="text-[11px] text-muted-foreground">Terhubung, bersaing, dan tumbuh bersama para driver</p>
                          </div>
                        </div>
                        {/* Items grid */}
                        <ul className="grid grid-cols-2 gap-1 mb-4">
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/feeds" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center group-hover/item:bg-pink-500/20 transition-colors">
                                <Grid3X3 className="w-4 h-4 text-pink-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">Social Feeds</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Momen dan aktivitas berkendara komunitas</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/leaderboard" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover/item:bg-amber-500/20 transition-colors">
                                <Trophy className="w-4 h-4 text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">Leaderboard</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Peringkat driver terbaik komunitas</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/achievements" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover/item:bg-emerald-500/20 transition-colors">
                                <Medal className="w-4 h-4 text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">Achievements</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Galeri lencana dan pencapaian driver</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/community-goals" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover/item:bg-indigo-500/20 transition-colors">
                                <Target className="w-4 h-4 text-indigo-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">Community Goals</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Capai target bersama seluruh komunitas</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li className="col-span-2">
                            <NavigationMenuLink
                              render={<Link href="/statistics" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center group-hover/item:bg-sky-500/20 transition-colors">
                                <BarChart3 className="w-4 h-4 text-sky-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">
                                  Statistics &amp; Analytics{" "}
                                  <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-sky-400 bg-sky-500/15 px-1.5 py-0.5 rounded-full">
                                    New
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Performa operasional Logistik &amp; Coaches (MoM, QoQ, YoY) + Public API</p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                        </ul>
                        {/* Footer banner */}
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-pink-500/10 border border-indigo-500/20 p-4 flex items-center gap-4">
                          <div className="shrink-0 w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                            <Users className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-foreground">Nismara Transport</p>
                            <p className="text-xs text-muted-foreground">Bergabung dan jadilah bagian dari komunitas driver terbaik</p>
                          </div>
                          <NavigationMenuLink
                            render={<Link href="/feeds" />}
                            className="ml-auto shrink-0 text-xs font-bold text-indigo-400 hover:text-indigo-300 whitespace-nowrap transition-colors"
                          >
                            Explore →
                          </NavigationMenuLink>
                        </div>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {/* Market Mega Menu */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="bg-transparent hover:bg-muted/50 data-[state=open]:bg-muted/50">
                      <ShoppingCart className="mr-2 h-4 w-4 text-muted-foreground" />
                      Market
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-[540px] p-5">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                          <div className="p-1.5 rounded-lg bg-primary/15">
                            <ShoppingCart className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-primary">
                              Nismara Markets
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Workshop mod, bursa P2P driver, dan pasar bahan bakar
                            </p>
                          </div>
                        </div>
                        <ul className="grid grid-cols-1 gap-1">
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/market" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover/item:bg-purple-500/20 transition-colors">
                                <ShoppingCart className="w-4 h-4 text-purple-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">
                                  Mod Workshop
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  Jual beli mod, livery, dan skin eksklusif karya kreator
                                </p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/community-market" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center group-hover/item:bg-teal-500/20 transition-colors">
                                <Store className="w-4 h-4 text-teal-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">
                                  Community Market{" "}
                                  <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-teal-400 bg-teal-500/15 px-1.5 py-0.5 rounded-full">
                                    New
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  Bursa P2P Voucher, Tiket Penghapus Penalti &amp; Buy Order antar-driver
                                </p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink
                              render={<Link href="/fuel-market" />}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-all group/item"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center group-hover/item:bg-yellow-500/20 transition-colors">
                                <Fuel className="w-4 h-4 text-yellow-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">
                                  Fuel Market
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  Sistem transaksi bahan bakar komunitas dan P2P BBM
                                </p>
                              </div>
                            </NavigationMenuLink>
                          </li>
                        </ul>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {/* Other Main Links */}
                  {mainMenuItems.map((item) => (
                    <NavigationMenuItem key={item.name}>
                      <NavigationMenuLink
                        render={<Link href={item.href} />}
                        className={navigationMenuTriggerStyle()}
                      >
                        <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {item.name}
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          {/* RIGHT SECTION: THEME & PROFILE */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link href="https://link.nismara.web.id/discord">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl border border-border/50 hidden sm:inline-flex"
              >
                <DiscordIcon />
              </Button>
            </Link>
            {session && <NotificationBell />}

            <ThemeToggle />

            <div className="hidden sm:block h-6 w-px bg-border mx-1"></div>

            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 p-0 rounded-full focus-visible:ring-0 overflow-visible"
                    />
                  }
                >
                  <DecoratedAvatar
                    src={session.user?.image || "/placeholder-avatar.png"}
                    alt={session.user?.name || "User"}
                    decorationId={(session.user as any)?.avatarDecoration || null}
                    isNismaraPlus={(session.user as any)?.nismaraplus?.status === true}
                    userRole={session.user?.role}
                    topManager={(session.user as any)?.topManager}
                    sizeClass="h-9 w-9"
                    frameClass="border-2 border-primary/30 shadow-sm bg-card"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-80 mt-2 p-2.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl"
                  align="end"
                >
                  {/* PROFILE IDENTITY MINI-CARD */}
                  <div
                    className={`relative rounded-xl p-3 mb-2.5 border overflow-visible ${
                      session.user?.nismaraplus?.status
                        ? "bg-linear-to-br from-amber-500/12 via-muted/70 to-card border-amber-500/25"
                        : "bg-linear-to-br from-primary/12 via-muted/70 to-card border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <DecoratedAvatar
                        src={session.user?.image || "/placeholder-avatar.png"}
                        alt={session.user?.name || "User"}
                        decorationId={
                          (session.user as any)?.avatarDecoration || null
                        }
                        isNismaraPlus={
                          (session.user as any)?.nismaraplus?.status === true
                        }
                        userRole={session.user?.role}
                        topManager={(session.user as any)?.topManager}
                        sizeClass="h-12 w-12"
                        frameClass="border border-primary/30 bg-primary/10"
                      />
                      <div className="flex flex-col min-w-0 flex-1 pr-7">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-sm text-foreground truncate">
                            {session.user?.name}
                          </span>
                          <UserBadges
                            role={session.user?.role}
                            isBooster={(session.user as any)?.isBooster === true}
                            isNismaraPlus={
                              (session.user as any)?.nismaraplus?.status === true
                            }
                            nismaraPlusStartedAt={
                              (session.user as any)?.nismaraplus?.startedAt
                            }
                            truckyRank={(session.user as any)?.truckyRank}
                            topManager={(session.user as any)?.topManager}
                            className="w-3.5 h-3.5 shrink-0"
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground capitalize truncate">
                          {session.user?.role || "Driver"} • Level{" "}
                          {session.user?.level || 1}
                        </span>
                      </div>

                      <DropdownMenuItem
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-background/60 hover:bg-background border border-border/50 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        title="Pengaturan Profil"
                        render={<Link href="/dashboard/settings" />}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </DropdownMenuItem>
                    </div>

                    {/* COMPACT BALANCE BAR */}
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5 text-amber-400" />
                        Saldo Nismara Coin
                      </span>
                      <span className="text-xs font-black text-primary tabular-nums">
                        {currency !== null
                          ? `${currency.toLocaleString("id-ID", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} NC`
                          : "..."}
                      </span>
                    </div>
                  </div>

                  {/* SECTION 1: AKUN SAYA (2x2 COMPACT TILES) */}
                  <div className="px-0.5 mb-2.5">
                    <div className="flex items-center justify-between px-1.5 mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                        Akun Saya
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <DropdownMenuItem
                        className="cursor-pointer rounded-xl px-2.5 py-2 bg-white/[0.03] hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/5 hover:border-primary/30 transition-all"
                        render={
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-2.5 w-full"
                          />
                        }
                      >
                        <span className="p-1.5 rounded-lg bg-primary/15 text-primary shrink-0">
                          <LayoutDashboard className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-bold text-foreground truncate">
                          Dashboard
                        </span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="cursor-pointer rounded-xl px-2.5 py-2 bg-white/[0.03] hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/5 hover:border-primary/30 transition-all"
                        render={
                          <Link
                            href={`/profile/${session.user?.truckyId || session.user?.driverData?.truckyId}`}
                            className="flex items-center gap-2.5 w-full"
                          />
                        }
                      >
                        <span className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
                          <User className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-bold text-foreground truncate">
                          Profil Publik
                        </span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="cursor-pointer rounded-xl px-2.5 py-2 bg-white/[0.03] hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/5 hover:border-primary/30 transition-all"
                        render={
                          <Link
                            href="/dashboard/garage"
                            className="flex items-center gap-2.5 w-full"
                          />
                        }
                      >
                        <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
                          <Truck className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-bold text-foreground truncate">
                          Garasi
                        </span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="cursor-pointer rounded-xl px-2.5 py-2 bg-white/[0.03] hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/5 hover:border-primary/30 transition-all"
                        render={
                          <Link
                            href="/dashboard/ticket"
                            className="flex items-center gap-2.5 w-full"
                          />
                        }
                      >
                        <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
                          <FileText className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-bold text-foreground truncate">
                          Tiket
                        </span>
                      </DropdownMenuItem>
                    </div>
                  </div>

                  {/* SECTION 2: MANAGER PORTAL (2x3 COMPACT GRID, REFINED ACCENT) */}
                  {(session.user?.role === "manager" ||
                    session.user?.role === "admin") && (
                    <div className="px-0.5 mb-2.5 pt-2 border-t border-border/60">
                      <div className="flex items-center justify-between px-1.5 mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-accent-lilac flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Manager Portal
                        </span>
                        <DropdownMenuItem
                          className="p-0 h-auto bg-transparent hover:bg-transparent focus:bg-transparent cursor-pointer"
                          render={
                            <Link
                              href="/dashboard/manage"
                              className="text-[10px] font-bold text-muted-foreground hover:text-accent-lilac inline-flex items-center gap-0.5 transition-colors"
                            />
                          }
                        >
                          Buka Hub <ArrowUpRight className="h-3 w-3" />
                        </DropdownMenuItem>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <DropdownMenuItem
                          className="cursor-pointer rounded-xl px-2.5 py-1.5 bg-accent-lilac/[0.06] hover:bg-accent-lilac/15 focus:bg-accent-lilac/15 border border-accent-lilac/15 transition-all"
                          render={
                            <Link
                              href="/dashboard/manage/payroll"
                              className="flex items-center gap-2 w-full"
                            />
                          }
                        >
                          <Coins className="h-3.5 w-3.5 text-accent-lilac shrink-0" />
                          <span className="text-xs font-semibold text-foreground truncate">
                            Payroll & KPI
                          </span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="cursor-pointer rounded-xl px-2.5 py-1.5 bg-accent-lilac/[0.06] hover:bg-accent-lilac/15 focus:bg-accent-lilac/15 border border-accent-lilac/15 transition-all"
                          render={
                            <Link
                              href="/dashboard/manage/tickets"
                              className="flex items-center gap-2 w-full"
                            />
                          }
                        >
                          <FileText className="h-3.5 w-3.5 text-accent-lilac shrink-0" />
                          <span className="text-xs font-semibold text-foreground truncate">
                            Kelola Tiket
                          </span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="cursor-pointer rounded-xl px-2.5 py-1.5 bg-accent-lilac/[0.06] hover:bg-accent-lilac/15 focus:bg-accent-lilac/15 border border-accent-lilac/15 transition-all"
                          render={
                            <Link
                              href="/dashboard/manage/fleet"
                              className="flex items-center gap-2 w-full"
                            />
                          }
                        >
                          <Truck className="h-3.5 w-3.5 text-accent-lilac shrink-0" />
                          <span className="text-xs font-semibold text-foreground truncate">
                            Kelola Fleet
                          </span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="cursor-pointer rounded-xl px-2.5 py-1.5 bg-accent-lilac/[0.06] hover:bg-accent-lilac/15 focus:bg-accent-lilac/15 border border-accent-lilac/15 transition-all"
                          render={
                            <Link
                              href="/dashboard/manage/events"
                              className="flex items-center gap-2 w-full"
                            />
                          }
                        >
                          <Sparkle className="h-3.5 w-3.5 text-accent-lilac shrink-0" />
                          <span className="text-xs font-semibold text-foreground truncate">
                            Kelola Events
                          </span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="cursor-pointer rounded-xl px-2.5 py-1.5 bg-accent-lilac/[0.06] hover:bg-accent-lilac/15 focus:bg-accent-lilac/15 border border-accent-lilac/15 transition-all"
                          render={
                            <Link
                              href="/dashboard/manage/season-pass"
                              className="flex items-center gap-2 w-full"
                            />
                          }
                        >
                          <Trophy className="h-3.5 w-3.5 text-accent-lilac shrink-0" />
                          <span className="text-xs font-semibold text-foreground truncate">
                            Season Pass
                          </span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="cursor-pointer rounded-xl px-2.5 py-1.5 bg-accent-lilac/[0.06] hover:bg-accent-lilac/15 focus:bg-accent-lilac/15 border border-accent-lilac/15 transition-all"
                          render={
                            <Link
                              href="/dashboard/manage/data"
                              className="flex items-center gap-2 w-full"
                            />
                          }
                        >
                          <User2 className="h-3.5 w-3.5 text-accent-lilac shrink-0" />
                          <span className="text-xs font-semibold text-foreground truncate">
                            Kelola Data
                          </span>
                        </DropdownMenuItem>
                      </div>
                    </div>
                  )}

                  {/* EXCLUSIVE MEMBERSHIP & PASS SECTION */}
                  <div className="px-0.5 pt-2 border-t border-border/60 space-y-1.5">
                    {/* SEASON PASS EXCLUSIVE CARD */}
                    {isSeasonPassEnabled && (
                      <DropdownMenuItem
                        className={`cursor-pointer rounded-xl p-2.5 flex flex-col gap-1.5 group transition-all duration-200 ${
                          seasonPass?.isPremium
                            ? "bg-amber-500/10 hover:bg-amber-500/20 focus:bg-amber-500/20 border border-amber-500/30"
                            : "bg-white/[0.03] hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/5 hover:border-amber-500/30"
                        }`}
                        render={
                          <Link
                            href="/dashboard/season-pass"
                            className="block w-full"
                          />
                        }
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                                seasonPass?.isPremium
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-slate-800 text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/10"
                              }`}
                            >
                              <Trophy className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span
                                className={`text-xs font-bold truncate leading-tight ${
                                  seasonPass?.isPremium
                                    ? "text-amber-400"
                                    : "text-foreground group-hover:text-amber-400 transition-colors"
                                }`}
                              >
                                Season Pass
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">
                                {seasonPass
                                  ? `S${seasonPass.seasonNumber} • Level ${seasonPass.currentLevel}`
                                  : "Season 1 • Level 0"}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                              seasonPass?.isPremium
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs shadow-amber-500/20"
                                : "bg-slate-800/80 text-slate-400 border-slate-700/60 group-hover:border-slate-600"
                            }`}
                          >
                            {seasonPass?.isPremium ? "PREMIUM" : "FREE"}
                          </span>
                        </div>

                        {/* Mini progress bar (Level 0 - 30) */}
                        <div className="w-full bg-slate-800/80 rounded-full h-1 overflow-hidden mt-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              seasonPass?.isPremium
                                ? "bg-linear-to-r from-amber-500 to-yellow-400"
                                : "bg-slate-600 group-hover:bg-amber-400"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  seasonPass?.currentLevel ? 4 : 2,
                                  Math.round(((seasonPass?.currentLevel ?? 0) / 30) * 100)
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      </DropdownMenuItem>
                    )}

                    {/* NISMARA+ CARD */}
                    <DropdownMenuItem
                      className={`cursor-pointer rounded-xl p-2.5 flex items-center justify-between group transition-all duration-200 ${
                        session.user?.nismaraplus?.status
                          ? "bg-amber-400/10 hover:bg-amber-400/20 focus:bg-amber-400/20 border border-amber-400/20"
                          : "bg-white/[0.03] hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/5 hover:border-amber-400/30"
                      }`}
                      render={
                        <Link
                          href="/dashboard/nismaraplus"
                          className="flex items-center w-full"
                        />
                      }
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                            session.user?.nismaraplus?.status
                              ? "bg-amber-400/20 text-amber-400"
                              : "bg-slate-800 text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-400/10"
                          }`}
                        >
                          <NismaraIcon className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`text-xs font-bold leading-tight truncate ${
                              session.user?.nismaraplus?.status
                                ? "text-amber-400"
                                : "text-foreground group-hover:text-amber-400 transition-colors"
                            }`}
                          >
                            Nismara+
                          </span>
                          {session.user?.nismaraplus?.status ? (
                            <span className="text-[9px] text-amber-500/80 uppercase tracking-widest font-black leading-tight mt-0.5">
                              Aktif s.d{" "}
                              {new Date(
                                session.user.nismaraplus.expiredAt
                              ).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">
                              Membership VIP
                            </span>
                          )}
                        </div>
                      </div>
                      {!session.user?.nismaraplus?.status && (
                        <span className="text-[9px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                          VIP
                        </span>
                      )}
                    </DropdownMenuItem>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border/60 px-0.5">
                    <DropdownMenuItem
                      className="text-red-400 hover:text-red-300 focus:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer flex items-center justify-center gap-2 rounded-xl font-bold text-xs py-2.5 border border-transparent hover:border-red-500/20 transition-all"
                      onClick={() => signOut()}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Keluar dari Akun
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login" className="hidden sm:block">
                <Button className="font-bold rounded-xl shadow-lg shadow-primary/20">
                  Login
                </Button>
              </Link>
            )}

            {/* MOBILE TOGGLE (SHEET) */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="xl:hidden" />
                }
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[85vw] sm:w-[350px] overflow-y-auto"
              >
                <SheetHeader className="text-left mb-6">
                  <SheetTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-linear-to-br from-primary to-accent-sky rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                      <NismaraIcon className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-xl tracking-tight uppercase">
                      Nismara <span className="text-accent-sky">Transport</span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1.5">
                  {mobileMenuItems.map((item, index) => (
                    <div key={item.name}>
                      {item.separator && (
                        <div className="h-px bg-border/50 my-2" />
                      )}
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center justify-between p-3 rounded-xl text-sm font-bold text-foreground/70 hover:bg-primary/10 hover:text-primary transition-all group/mobilenav"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-lg bg-muted group-hover/mobilenav:bg-background transition-colors">
                            <item.icon className="w-4 h-4" />
                          </div>
                          {item.name}
                        </div>
                        <ExternalLink className="w-4 h-4 opacity-0 group-hover/mobilenav:opacity-30 transition-opacity" />
                      </Link>
                    </div>
                  ))}

                  <div className="h-px bg-border/50 my-2" />

                  {/* DISCORD LINK ON MOBILE */}
                  <Link
                    href="https://link.nismara.web.id/discord"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between p-3 rounded-xl text-sm font-bold text-foreground/70 hover:bg-[#5865F2]/10 hover:text-[#5865F2] transition-all group/discord"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-muted group-hover/discord:bg-background transition-colors">
                        <DiscordIcon />
                      </div>
                      Discord Server
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-0 group-hover/discord:opacity-30 transition-opacity" />
                  </Link>
                </nav>
                {!session && (
                  <div className="mt-8 border-t border-border pt-6 pb-4">
                    <Link
                      href="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button
                        className="w-full font-bold shadow-lg shadow-primary/20"
                        size="lg"
                      >
                        Login Driver
                      </Button>
                    </Link>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}
