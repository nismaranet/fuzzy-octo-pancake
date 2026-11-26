"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Briefcase,
  Coins,
  Settings,
  TriangleAlert,
  Sparkles,
  ReceiptText,
  BookOpen,
  User2,
  Shield,
  FileText,
  ShieldCheck,
  MoreHorizontal,
  Ticket,
  Trophy,
  Crown,
  Radio,
  Store,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Database,
  CalendarDays,
  Wrench,
  Users,
  Sliders,
  ArrowLeftRight,
  Package,
  Gift,
  Compass,
  ClipboardList,
  Target,
  MonitorPlay,
  FileQuestion,
  Zap,
  Award,
  X,
  HelpCircle,
  Wallet,
} from "lucide-react";

type LucideIcon = typeof LayoutDashboard;

interface NavLeaf {
  name: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  id: string;
  name: string;
  icon: LucideIcon;
  children: NavLeaf[];
}

type NavNode =
  | ({ kind: "link" } & NavLeaf)
  | ({ kind: "group" } & NavGroup);

interface NavSection {
  id: string;
  label: string;
  accent: "primary" | "sky" | "amber";
  nodes: NavNode[];
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background";

function isLeafActive(pathname: string, leaf: NavLeaf): boolean {
  if (leaf.exact) {
    return pathname === leaf.href;
  }
  return pathname === leaf.href || pathname.startsWith(`${leaf.href}/`);
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.children.some((child) => isLeafActive(pathname, child));
}

export default function DashboardSidebar({
  userRole,
  isOwner = false,
  isSeasonPassEnabled = true,
  isTrackerEnabled = false,
}: {
  userRole?: string;
  isOwner?: boolean;
  isSeasonPassEnabled?: boolean;
  isTrackerEnabled?: boolean;
}) {
  const pathname = usePathname() || "/dashboard";
  const isManager = userRole === "manager" || userRole === "admin";

  const sections = useMemo<NavSection[]>(() => {
    const driverFleetChildren: NavLeaf[] = [
      { name: "Garage", href: "/dashboard/garage", icon: Truck },
      { name: "Job History", href: "/dashboard/jobs", icon: Briefcase },
      { name: "Insurance", href: "/dashboard/insurance", icon: Shield },
      ...(isTrackerEnabled
        ? [{ name: "Nismara Tracker", href: "/dashboard/tracker", icon: Radio }]
        : []),
    ];

    const membershipChildren: NavLeaf[] = [
      { name: "Nismara+", href: "/dashboard/nismaraplus", icon: Crown },
      ...(isSeasonPassEnabled
        ? [{ name: "Season Pass", href: "/dashboard/season-pass", icon: Trophy }]
        : []),
    ];

    const result: NavSection[] = [
      {
        id: "driver",
        label: "Driver Menu",
        accent: "primary",
        nodes: [
          {
            kind: "link",
            name: "Overview",
            href: "/dashboard",
            icon: LayoutDashboard,
            exact: true,
          },
          {
            kind: "group",
            id: "driver-fleet",
            name: "Armada & Perjalanan",
            icon: Truck,
            children: driverFleetChildren,
          },
          {
            kind: "group",
            id: "driver-finance",
            name: "Keuangan & Aset",
            icon: Wallet,
            children: [
              { name: "Wallet", href: "/dashboard/currency", icon: Coins },
              { name: "My Vouchers", href: "/dashboard/vouchers", icon: Ticket },
              { name: "Transactions", href: "/dashboard/transactions", icon: ReceiptText },
              { name: "Penalty Points", href: "/dashboard/points", icon: TriangleAlert },
            ],
          },
          {
            kind: "group",
            id: "driver-membership",
            name: "Membership & Progres",
            icon: Crown,
            children: membershipChildren,
          },
          {
            kind: "group",
            id: "driver-market",
            name: "Market & Koleksi",
            icon: Store,
            children: [
              { name: "My Market", href: "/dashboard/my-market", icon: Briefcase },
              { name: "My Library", href: "/dashboard/library", icon: FileText },
            ],
          },
          {
            kind: "group",
            id: "driver-account",
            name: "Bantuan & Akun",
            icon: HelpCircle,
            children: [
              { name: "Driver Guide", href: "/dashboard/driver-guide", icon: BookOpen },
              { name: "Tickets", href: "/dashboard/ticket", icon: FileText },
              { name: "Profile Settings", href: "/dashboard/settings", icon: Settings },
            ],
          },
        ],
      },
    ];

    if (isManager) {
      result.push({
        id: "management",
        label: "Management Portal",
        accent: "sky",
        nodes: [
          {
            kind: "link",
            name: "Manager Overview",
            href: "/dashboard/manage",
            icon: ShieldCheck,
            exact: true,
          },
          {
            kind: "group",
            id: "manage-data",
            name: "Manage Data",
            icon: Database,
            children: [
              {
                name: "Hub Manage Data",
                href: "/dashboard/manage/data",
                icon: Database,
                exact: true,
              },
              { name: "User List", href: "/dashboard/manage/data/users", icon: Users },
              { name: "Manage Intern", href: "/dashboard/manage/data/intern", icon: User2 },
              { name: "Manage HaulMP", href: "/dashboard/manage/data/haulmp", icon: Truck },
              { name: "Manage NC", href: "/dashboard/manage/data/nc-data", icon: Coins },
              { name: "Manage Poin", href: "/dashboard/manage/data/point-data", icon: Target },
              { name: "Manage Market", href: "/dashboard/manage/data/market", icon: Store },
              {
                name: "Manage Achievement",
                href: "/dashboard/manage/data/achievement",
                icon: Award,
              },
              {
                name: "Avatar Decorations",
                href: "/dashboard/manage/data/avatar-decorations",
                icon: Sparkles,
              },
              { name: "Quiz & Ujian", href: "/dashboard/manage/data/quiz", icon: FileQuestion },
              { name: "Knowledge Base", href: "/dashboard/manage/kb", icon: BookOpen },
              {
                name: "Global Popup Ad",
                href: "/dashboard/manage/data/popup",
                icon: MonitorPlay,
              },
            ],
          },
          {
            kind: "group",
            id: "manage-events",
            name: "Manage Events",
            icon: Sparkles,
            children: [
              {
                name: "Hub Manage Events",
                href: "/dashboard/manage/events",
                icon: CalendarDays,
                exact: true,
              },
              {
                name: "Convoy Lobbies",
                href: "/dashboard/manage/events/convoy",
                icon: Radio,
              },
              {
                name: "Special Contract",
                href: "/dashboard/manage/events/contracts",
                icon: FileText,
              },
              {
                name: "NC Boost Events",
                href: "/dashboard/manage/events/ncboost",
                icon: Zap,
              },
              {
                name: "Surveys & Polling",
                href: "/dashboard/manage/surveys",
                icon: ClipboardList,
              },
              { name: "Coupons", href: "/dashboard/manage/events/coupon", icon: Ticket },
              {
                name: "Community Goals",
                href: "/dashboard/manage/community-goals",
                icon: Compass,
              },
              { name: "Giveaways", href: "/dashboard/manage/giveaways", icon: Gift },
            ],
          },
          {
            kind: "group",
            id: "manage-fleets",
            name: "Manage Fleets",
            icon: Truck,
            children: [
              {
                name: "Hub Manage Fleets",
                href: "/dashboard/manage/fleet",
                icon: Truck,
                exact: true,
              },
              {
                name: "Brand Management",
                href: "/dashboard/manage/fleet/brand",
                icon: Award,
              },
              { name: "Fleet Store", href: "/dashboard/manage/fleet/store", icon: Store },
              {
                name: "Fleet Assignment",
                href: "/dashboard/manage/fleet/assign",
                icon: Users,
              },
              {
                name: "Fleet Order List",
                href: "/dashboard/manage/fleet/orderlist",
                icon: ClipboardList,
              },
              {
                name: "Fleet Service List",
                href: "/dashboard/manage/fleet/service",
                icon: Wrench,
              },
              { name: "Cargo Directory", href: "/dashboard/manage/cargo", icon: Package },
            ],
          },
          {
            kind: "group",
            id: "manage-programs",
            name: "Program & Market",
            icon: Trophy,
            children: [
              {
                name: "Manage Season Pass",
                href: "/dashboard/manage/season-pass",
                icon: Trophy,
              },
              {
                name: "Manage N+ Quests",
                href: "/dashboard/manage/nismaraplus/quests",
                icon: Crown,
              },
              {
                name: "Community Market",
                href: "/dashboard/manage/community-market",
                icon: Store,
              },
            ],
          },
          {
            kind: "group",
            id: "manage-ops",
            name: "Staff, Support & Audit",
            icon: ShieldCheck,
            children: [
              { name: "Payroll & KPI", href: "/dashboard/manage/payroll", icon: Coins, exact: true },
              { name: "Manage Tickets", href: "/dashboard/manage/tickets", icon: FileText },
              { name: "Audit Center", href: "/dashboard/manage/audit", icon: ShieldCheck },
              { name: "Security Alerts", href: "/dashboard/manage/security", icon: Shield },
            ],
          },
        ],
      });
    }

    if (isOwner) {
      result.push({
        id: "owner",
        label: "Owner Tools",
        accent: "amber",
        nodes: [
          {
            kind: "group",
            id: "owner-tools",
            name: "Owner Tools",
            icon: Crown,
            children: [
              {
                name: "Changelog Hub",
                href: "/dashboard/manage/changelog",
                icon: ScrollText,
              },
              {
                name: "Payroll Templates",
                href: "/dashboard/manage/payroll/templates",
                icon: Coins,
              },
              {
                name: "Owner Voucher Lab",
                href: "/dashboard/manage/vouchers",
                icon: Ticket,
              },
              {
                name: "Manage Nismara+",
                href: "/dashboard/manage/data/nismaraplus",
                icon: Crown,
              },
              {
                name: "Migrasi Akun Discord",
                href: "/dashboard/manage/data/migrate-account",
                icon: ArrowLeftRight,
              },
              {
                name: "Web Configuration",
                href: "/dashboard/manage/data/web-config",
                icon: Sliders,
              },
            ],
          },
        ],
      });
    }

    return result;
  }, [isManager, isOwner, isSeasonPassEnabled, isTrackerEnabled]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Otomatis buka hanya grup dari halaman aktif saat berpindah rute
  useEffect(() => {
    const activeMap: Record<string, boolean> = {};
    for (const sec of sections) {
      for (const node of sec.nodes) {
        if (node.kind === "group" && isGroupActive(pathname, node)) {
          activeMap[node.id] = true;
        }
      }
    }
    setOpenGroups(activeMap);
    setMobileMenuOpen(false);
  }, [pathname, sections]);

  // Tutup mobile drawer dengan tombol Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const accentClasses = {
    primary: {
      heading: "text-muted-foreground",
      activeLink:
        "bg-primary/15 text-primary border-primary/30 font-semibold",
      activeParent: "text-primary bg-primary/10 font-semibold",
      hover: "hover:text-foreground hover:bg-muted/40",
    },
    sky: {
      heading: "text-sky-400",
      activeLink:
        "bg-sky-500/15 text-sky-300 border-sky-500/30 font-semibold",
      activeParent: "text-sky-300 bg-sky-500/10 font-semibold",
      hover: "hover:text-foreground hover:bg-muted/40",
    },
    amber: {
      heading: "text-amber-400",
      activeLink:
        "bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold",
      activeParent: "text-amber-300 bg-amber-500/10 font-semibold",
      hover: "hover:text-foreground hover:bg-muted/40",
    },
  };

  const renderNavSections = (isMobile = false) => (
    <div className={isMobile ? "space-y-5" : "space-y-5"}>
      {sections.map((section, secIdx) => {
        const theme = accentClasses[section.accent];
        return (
          <div
            key={section.id}
            className={secIdx > 0 ? "border-t border-border/60 pt-4" : ""}
          >
            <h2
              className={`px-2.5 text-[11px] font-bold uppercase tracking-wider mb-2 ${theme.heading}`}
            >
              {section.label}
            </h2>

            <nav aria-label={section.label} className="space-y-1">
              {section.nodes.map((node) => {
                if (node.kind === "link") {
                  const active = isLeafActive(pathname, node);
                  const Icon = node.icon;
                  return (
                    <Link
                      key={node.href}
                      href={node.href}
                      onClick={() => isMobile && setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 rounded-lg border transition-colors text-sm ${
                        isMobile ? "min-h-[44px]" : "py-2"
                      } ${FOCUS_RING} ${
                        active
                          ? theme.activeLink
                          : `border-transparent text-muted-foreground ${theme.hover}`
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{node.name}</span>
                    </Link>
                  );
                }

                const open = Boolean(openGroups[node.id]);
                const hasActiveChild = isGroupActive(pathname, node);
                const GroupIcon = node.icon;

                return (
                  <div key={node.id} className="space-y-0.5">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggleGroup(node.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 rounded-lg border border-transparent transition-colors text-sm cursor-pointer ${
                        isMobile ? "min-h-[44px]" : "py-2"
                      } ${FOCUS_RING} ${
                        hasActiveChild
                          ? theme.activeParent
                          : `text-muted-foreground ${theme.hover}`
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <GroupIcon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{node.name}</span>
                      </span>
                      {open ? (
                        <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
                      )}
                    </button>

                    {open && (
                      <div className="ml-4 pl-2.5 border-l border-border/70 space-y-0.5 py-0.5">
                        {node.children.map((child) => {
                          const childActive = isLeafActive(pathname, child);
                          const ChildIcon = child.icon;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => isMobile && setMobileMenuOpen(false)}
                              className={`flex items-center gap-2.5 px-2.5 rounded-lg border transition-colors text-xs ${
                                isMobile ? "min-h-[42px] text-sm" : "py-1.5"
                              } ${FOCUS_RING} ${
                                childActive
                                  ? theme.activeLink
                                  : `border-transparent text-muted-foreground ${theme.hover}`
                              }`}
                            >
                              <ChildIcon className="w-3.5 h-3.5 shrink-0 opacity-85" />
                              <span className="truncate">{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        );
      })}
    </div>
  );

  // 4 pintasan utama untuk Mobile Bottom Bar
  const primaryMobileItems = [
    { name: "Home", href: "/dashboard", icon: LayoutDashboard, exact: true },
    { name: "Garage", href: "/dashboard/garage", icon: Truck },
    { name: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
    { name: "Wallet", href: "/dashboard/currency", icon: Coins },
  ];

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden xl:block w-64 shrink-0 border-r border-border/60 bg-background h-[calc(100vh-5rem)] sticky top-20 z-40">
        <div className="p-4 overflow-y-auto no-scrollbar h-full">
          {renderNavSections(false)}
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav
        aria-label="Navigasi Cepat Mobile"
        className="xl:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 pt-1.5 pb-3"
      >
        {primaryMobileItems.map((item) => {
          const active = isLeafActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[44px] px-2 py-1 rounded-lg transition-colors ${FOCUS_RING} ${
                active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-none">{item.name}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-expanded={mobileMenuOpen}
          aria-label="Buka semua menu dashboard"
          className={`flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[44px] px-2 py-1 rounded-lg transition-colors cursor-pointer ${FOCUS_RING} ${
            mobileMenuOpen
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] leading-none">Menu</span>
        </button>
      </nav>

      {/* MOBILE SLIDE-OVER MENU DRAWER */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu Dashboard"
          className="xl:hidden fixed inset-0 z-[60] bg-black/65 flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="w-full max-w-xs h-full bg-card border-l border-border shadow-2xl flex flex-col">
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Menu Dashboard</span>
              <button
                type="button"
                aria-label="Tutup menu dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground cursor-pointer ${FOCUS_RING}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-10">
              {renderNavSections(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
