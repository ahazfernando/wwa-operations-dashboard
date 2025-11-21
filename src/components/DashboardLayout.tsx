"use client";

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Clock as ClockIcon, 
  Star, 
  Users, 
  Calendar, 
  DollarSign, 
  FileText,
  LogOut,
  Settings,
  User,
  CheckSquare,
  History,
  CheckCircle,
  Bell,
  MapPin
} from 'lucide-react';

const menuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'operationsstaff', 'itteam'] },
  { title: 'Profile', url: '/profile', icon: User, roles: ['admin', 'operationsstaff', 'itteam'] },
  { title: 'Clock In/Out', url: '/clock', icon: ClockIcon, roles: ['admin', 'operationsstaff', 'itteam'] },
  { title: 'Work From Home Location', url: '/work-from-home', icon: MapPin, roles: ['admin', 'operationsstaff', 'itteam'] },
  { title: 'Employee Ratings', url: '/ratings', icon: Star, roles: ['admin', 'operationsstaff'] },
  { title: 'Lead Tracking', url: '/leads', icon: Users, roles: ['admin', 'operationsstaff', 'itteam'] },
  { title: 'Tasks', url: '/tasks', icon: CheckSquare, roles: ['admin', 'operationsstaff', 'itteam'] },
  { title: 'Reminders', url: '/reminders', icon: Bell, roles: ['admin', 'operationsstaff', 'itteam'] },
  { title: 'Availability', url: '/availability', icon: CheckCircle, roles: ['admin', 'operationsstaff', 'itteam'] },
  { title: 'Leave Management', url: '/leave', icon: Calendar, roles: ['admin', 'operationsstaff'], badge: 'Soon' },
  { title: 'SaaS Config', url: '/saas', icon: DollarSign, roles: ['admin'], badge: 'Soon' },
  { title: 'CV Automation', url: '/cv-automation', icon: FileText, roles: ['admin', 'operationsstaff'], badge: 'Soon' },
];

function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const filteredItems = menuItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar className={isCollapsed ? 'w-14' : 'w-64'}>
      <SidebarContent>
        <div className="p-4 border-b border-sidebar-border">
          {!isCollapsed && (
            <img 
              src="/logos/WWA - White (1).png" 
              alt="We Will AU" 
              className="h-8 w-auto object-contain"
            />
          )}
          {isCollapsed && (
            <img 
              src="/logos/WWA - White (1).png" 
              alt="We Will AU" 
              className="h-8 w-auto object-contain mx-auto"
            />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && (
                        <span className="flex items-center gap-2">
                          {item.title}
                          {item.badge && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/settings" 
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <Settings className="h-4 w-4" />
                      {!isCollapsed && <span>Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <div className="mt-auto p-4 border-t border-sidebar-border">
          {!isCollapsed && user && (
            <div className="mb-3 space-y-1">
              <p className="text-sm font-medium text-sidebar-foreground">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/70 capitalize">{user.role}</p>
            </div>
          )}
          <Button 
            variant="ghost" 
            size={isCollapsed ? 'icon' : 'default'}
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Logout</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}