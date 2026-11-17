"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, Bell, FileUser, LogOut, Mail, MapPin, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logout } from "@/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavigationStrings } from "@/lib/i18n/navigation";
import { userIdentity } from "@/lib/ui/user-identity";
import { UserAvatar } from "./UserAvatar";

export interface UserMenuUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "USER" | "ADMIN";
  /** Only the allowlisted owner sees the activity log link (checked on the server). */
  canViewActivity?: boolean;
}

const item = "min-h-11 gap-2.5 px-2.5 text-sm font-semibold md:min-h-9";

/** Header account button: shows who is signed in and opens profile, settings and log out. */
export function UserMenu({ user, strings }: { user: UserMenuUser; strings: NavigationStrings["userMenu"] }) {
  const me = userIdentity(user);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const logoutForm = useRef<HTMLFormElement>(null);
  useEffect(() => setOpen(false), [pathname]);

  const links: { href: string; label: string; icon: LucideIcon; id: string }[] = [
    { id: "profile", href: "/profile", label: strings.profile, icon: FileUser },
    { id: "notifications", href: "/settings/notifications", label: strings.notifications, icon: Bell },
    { id: "email", href: "/settings/email", label: strings.email, icon: Mail },
    { id: "places", href: "/settings/places", label: strings.places, icon: MapPin },
  ];
  if (user.role === "ADMIN") links.push({ id: "admin", href: "/admin", label: strings.admin, icon: ShieldCheck });
  if (user.canViewActivity) {
    links.push({ id: "activity", href: "/admin/activity", label: strings.activity, icon: Activity });
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          data-testid="user-menu-trigger"
          aria-label={strings.openFor.replace("{name}", me.displayName)}
          className="hover:bg-muted aria-expanded:bg-muted focus-visible:ring-ring/50 flex size-11 shrink-0 items-center justify-center gap-2 rounded-full outline-none focus-visible:ring-3 xl:w-auto xl:max-w-44 xl:rounded-md xl:ps-1.5 xl:pe-2.5"
        >
          <UserAvatar image={me.image} initials={me.initials} />
          <span className="hidden truncate text-sm font-semibold xl:block" dir="auto">
            {me.displayName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          data-testid="user-menu"
          className="w-[min(18rem,calc(100vw-1.5rem))] p-1.5"
        >
          <DropdownMenuLabel className="flex items-center gap-3 p-2">
            <UserAvatar image={me.image} initials={me.initials} className="size-10 text-sm" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="sr-only">{strings.signedInAs}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-bold" dir="auto" data-testid="user-menu-name">
                  {me.displayName}
                </span>
                {user.role === "ADMIN" && (
                  <span className="bg-primary/12 text-primary shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-bold">
                    {strings.adminBadge}
                  </span>
                )}
              </span>
              <span
                className="text-muted-foreground truncate text-start text-xs font-normal"
                dir="ltr"
                data-testid="user-menu-email"
              >
                {me.email}
              </span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {links.map(({ id, href, label, icon: Icon }) => (
              <DropdownMenuItem key={id} asChild className={item}>
                <Link
                  href={href}
                  data-testid={`user-menu-link-${id}`}
                  aria-current={pathname === href ? "page" : undefined}
                >
                  <Icon aria-hidden className="text-muted-foreground" />
                  {label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className={item}
            data-testid="user-menu-logout"
            onSelect={() => logoutForm.current?.requestSubmit()}
          >
            <LogOut aria-hidden className="rtl:-scale-x-100" />
            {strings.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Lives outside the menu so it survives the menu closing; works as a plain form post too. */}
      <form ref={logoutForm} action={logout} className="hidden" aria-hidden />
    </>
  );
}
