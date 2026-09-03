"use client";

import { ChevronsUpDown, LogOut, Moon, Sun, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { authService } from "@/lib/auth-service";
import { logout } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function NavUser() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { theme, setTheme } = useTheme();
  const user = useAppSelector((state) => state.auth.userData);

  const signOut = async () => {
    await authService.logout().catch(() => undefined);
    dispatch(logout());
    router.replace("/login");
  };

  const name = user?.name ?? "Admin User";
  const email = user?.email ?? "admin@clinicconnect.com";
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-full border border-border">
                <AvatarFallback className="rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left text-xs truncate leading-tight">
                <span className="truncate font-semibold text-foreground">{name}</span>
                <span className="truncate text-muted-foreground text-[10px]">
                  {isSuperAdmin ? "Super Admin" : "Clinic Admin"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-56 rounded-lg"
            side="bottom"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex flex-col items-center gap-1 px-2 py-3 text-center">
                <Avatar className="size-10 rounded-full border border-border">
                  <AvatarFallback className="rounded-full text-sm font-semibold bg-primary text-primary-foreground">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <span className="mt-1 truncate font-medium text-sm text-foreground">{name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {email}
                </span>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {theme === "dark" ? <Moon className="size-4 mr-2" /> : <Sun className="size-4 mr-2" />}
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent sideOffset={8} className="min-w-36">
                  <DropdownMenuItem onClick={() => setTheme("light")}>
                    <Sun className="size-4 mr-2" />
                    Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>
                    <Moon className="size-4 mr-2" />
                    Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>
                    <UserCheck className="size-4 mr-2" />
                    System
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="size-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
