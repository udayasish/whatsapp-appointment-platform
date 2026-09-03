"use client";

import { Building2, ChevronRight, Clock, QrCode } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavUser } from "@/components/nav-user";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAppSelector } from "@/store/hooks";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const user = useAppSelector((state) => state.auth.userData);
  const isSuperAdmin = user?.role === "super_admin";

  const navItems = isSuperAdmin
    ? [
        { title: "Clinics Directory", url: "/super-admin", icon: Building2 },
      ]
    : [
        { title: "Today's Queue", url: "/dashboard", icon: Clock },
        { title: "QR & Standee", url: "/dashboard/qr", icon: QrCode },
      ];

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            C
          </div>
          <div className="flex flex-col text-left">
            <span className="font-semibold text-sm leading-none">ClinicConnect</span>
            <span className="text-muted-foreground text-[10px] mt-0.5">
              {isSuperAdmin ? "Super Admin Platform" : "OPD Management"}
            </span>
          </div>
        </div>
        <NavUser />
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel
              asChild
              className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-xs"
            >
              <CollapsibleTrigger>
                {isSuperAdmin ? "Administration" : "Clinic Workspace"}
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
