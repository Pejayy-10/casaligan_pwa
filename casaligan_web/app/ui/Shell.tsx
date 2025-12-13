"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminProfile } from "../contexts/AdminProfileContext";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  UserCheck,
  ClipboardList,
  Calendar,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Star,
  Activity,
  Shield,
  AlertTriangle,
  Bell,
  ChevronRight,
  LogOut,
  User
} from "lucide-react";

type ShellProps = {
  children: React.ReactNode;
};

export default function Shell({ children }: ShellProps) {
  const sidebarWidth = 200;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { profile } = useAdminProfile();
  const pathname = usePathname();
  const router = useRouter();

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { isAuthenticated, isAdmin } = await import("@/lib/supabase/auth");
      
      if (!isAuthenticated()) {
        router.push("/auth");
        return;
      }
      
      if (!isAdmin()) {
        router.push("/auth");
        return;
      }
    };
    
    checkAuth();
  }, [router]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const menu: Array<
    | { key: string; label: string; href: string; icon: React.ComponentType<{ className?: string }> }
    | { key: string; label: string; icon: React.ComponentType<{ className?: string }>; children: { key: string; label: string; href: string; icon: React.ComponentType<{ className?: string }> }[] }
  > = [
    { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
    {
      key: "users",
      label: "Users",
      icon: Users,
      children: [
        { key: "employers", label: "Employers", href: "/users/employers", icon: Briefcase },
        { key: "workers", label: "Workers", href: "/users/workers", icon: UserCheck },
        { key: "verification", label: "Verification", href: "/users/verification", icon: ClipboardList },
      ],
    },
    {
      key: "jobs-and-bookings",
      label: "Job and Bookings",
      icon: ClipboardList,
      children: [
        { key: "job-posts", label: "Job Posts", href: "/jobs", icon: ClipboardList },
        { key: "bookings", label: "Bookings", href: "/bookings", icon: Calendar },
      ],
    },
    { key: "payments", label: "Payments", href: "/payments", icon: DollarSign },
    { key: "matching-analytics", label: "Matching Analytics", href: "/matching-analytics", icon: TrendingUp },
    { key: "messages", label: "Messages", href: "/messages", icon: MessageSquare },
    { key: "reviews", label: "Reviews", href: "/reviews", icon: Star },
    { key: "activity-log", label: "Activity Log", href: "/activity-log", icon: Activity },
    { key: "security", label: "Security", href: "/security", icon: Shield },
    { key: "reports", label: "Reports", href: "/reports", icon: AlertTriangle },
  ];

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Use database auth logout (clears localStorage)
      const { logout } = await import("@/lib/supabase/auth");
      logout();
      router.push("/auth");
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <header className="fixed top-0 right-0 h-12 z-50 border-b border-border bg-muted text-foreground flex items-center justify-between px-3" style={{ left: sidebarWidth }}>
        <div className="flex items-center gap-3">
        </div>
        <div className="flex items-center gap-3">
          <Link href="/notifications" aria-label="Notifications" className="relative rounded-md p-2 hover:bg-muted/50">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-danger"></span>
          </Link>
          <Link href="/profile" aria-label="Profile">
            <div className="h-8 w-8 rounded-full bg-primary/90 ring-2 ring-border flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
          </Link>
        </div>
      </header>

      <aside
        className="fixed top-0 left-0 h-screen overflow-hidden border-r border-border bg-muted text-foreground p-3 z-50 flex flex-col"
        style={{ width: sidebarWidth }}
      >
        <div className="mb-6 flex items-center gap-2 h-14">
          <div className="h-8 w-8 rounded-full bg-primary/90" aria-label="Logo placeholder"></div>
          <Link href="/" aria-label="Go to home">
            <Image className="logo-dark-invert" src="/Casaligan.svg" alt="Casaligan" width={90} height={100} priority />
          </Link>
        </div>
        <div className="mb-6">
          <Link href="/profile" className="w-full flex items-center gap-4 rounded-lg p-2 bg-border">
            <div className="h-8 w-8 rounded-full bg-primary/90 ring-2 ring-border flex items-center justify-center" aria-label="Profile picture">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <p className="font-sans text-[13px]">{profile?.users?.name || "Admin"}</p>
            </div>
          </Link>
        </div>
        <div className="mb-5">
          <h2 className="font-heading text-[13px]">Menu</h2>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-2">
            {menu.map((item) => (
              <li key={item.key}>
                {"href" in item ? (
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors ${
                      isActive(item.href)
                        ? "bg-tertiary/90 text-accent font-semibold"
                        : "hover:bg-tertiary/70 hover:text-accent"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="block text-[13px]">{item.label}</span>
                  </Link>
                ) : (
                  <>
                    {(() => {
                      const groupActive = item.children.some((child) => isActive(child.href));
                      return (
                        <>
                    <button
                      type="button"
                          aria-expanded={groupActive || !!openGroups[item.key]}
                          aria-controls={`${item.key}-submenu`}
                          onClick={() => toggleGroup(item.key)}
                          className={`w-full flex items-center justify-between rounded-md px-2.5 py-2 transition-colors ${
                            groupActive ? "bg-tertiary/90 text-accent font-semibold" : "hover:bg-tertiary/70 hover:text-accent"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <item.icon className="h-4 w-4" />
                            <span className="block text-[13px]">{item.label}</span>
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${
                              groupActive || openGroups[item.key] ? "rotate-90" : "rotate-0"
                            }`}
                          />
                        </button>
                    <ul
                      id={`${item.key}-submenu`}
                          className={`${groupActive || openGroups[item.key] ? "block" : "hidden"} mt-1 ml-6 space-y-1`}
                    >
                      {item.children.map((child) => (
                        <li key={child.key}>
                          <Link
                            href={child.href}
                            aria-current={isActive(child.href) ? "page" : undefined}
                                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors ${
                              isActive(child.href)
                                ? "bg-tertiary/90 text-accent font-semibold"
                                : "hover:bg-tertiary/70 hover:text-accent"
                            }`}
                          >
                            <child.icon className="h-3 w-3" />
                                <span className="block text-[13px]">{child.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                        </>
                      );
                    })()}
                  </>
                )}
              </li>
            ))}
            <li className="pt-4 mt-4 border-t border-border">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-destructive/20 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="h-4 w-4" />
                <span className="block text-[13px]">{isLoggingOut ? "Logging out..." : "Logout"}</span>
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <main
        className="pt-12 min-h-screen bg-background text-foreground transition-[margin] duration-200 ease-in-out"
        style={{ marginLeft: sidebarWidth }}
      >
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </>
  );
}


