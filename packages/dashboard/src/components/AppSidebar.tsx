import { Home, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/i18n";

const navigationItems = [
  { key: "nav.home", url: "/", icon: Home },
  { key: "nav.patients", url: "/patients", icon: Users },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { t } = useI18n();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <div
            className={
              open
                ? "flex items-center justify-between px-3 py-2"
                : "flex items-center justify-center px-0 py-2"
            }
          >
            {open && (
              <SidebarGroupLabel className="text-lg font-semibold text-primary">
                {t("app.name")}
              </SidebarGroupLabel>
            )}
            <SidebarTrigger className="h-8 w-8 p-0 hover:bg-accent/50 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground transition-colors" />
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-accent/50 transition-colors"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      {open && <span>{t(item.key)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
