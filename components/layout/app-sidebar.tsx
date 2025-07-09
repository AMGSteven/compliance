"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Route,
  CheckCircle,
  FileText,
  Zap,
  Database,
  BarChart3,
  Code,
  ChevronRight,
  Shield,
} from "lucide-react"

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Navigation items structure
const navigationItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Lead Management",
    icon: Users,
    items: [
      {
        title: "Add New Lead",
        href: "/leads/test",
        icon: UserPlus,
      },
      {
        title: "Leads",
        href: "/dashboard/leads",
        icon: Users,
      },
      {
        title: "List Routings",
        href: "/dashboard/list-routings",
        icon: Route,
      },
    ],
  },
  {
    title: "Compliance Tools",
    icon: CheckCircle,
    items: [
      {
        title: "Multi Source Compliance",
        href: "/compliance",
        icon: CheckCircle,
      },
      {
        title: "CSV Batch Compliance",
        href: "/compliance/batch",
        icon: FileText,
      },
      {
        title: "Fast Batch (25k+ Records)",
        href: "/compliance/batch-fast",
        icon: Zap,
      },
    ],
  },
  {
    title: "Data Management",
    icon: Database,
    items: [
      {
        title: "DNC CSV Upload",
        href: "/dnc/csv-upload",
        icon: Database,
      },
      {
        title: "Bulk Claim TF Certs",
        href: "/data-management/bulk-claim-tf",
        icon: Shield,
      },
    ],
  },
  {
    title: "Analytics & Reporting",
    icon: BarChart3,
    items: [
      {
        title: "Revenue Tracking",
        href: "/dashboard/revenue-tracking",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "Developer Tools",
    icon: Code,
    items: [
      {
        title: "API Docs",
        href: "/docs/api",
        icon: Code,
      },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  // Helper function to check if a path is active
  const isPathActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname === href || pathname.startsWith(href + "/")
  }

  // Helper function to check if a group has any active items
  const isGroupActive = (items?: Array<{ href: string }>) => {
    if (!items) return false
    return items.some(item => isPathActive(item.href))
  }

  return (
    <Sidebar variant="inset" className="border-0 w-64">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
      <div className="relative z-10">
        <SidebarHeader className="border-b border-slate-700/50">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-lg blur-sm" />
              <img 
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3e7ab034-c4d7-498f-bd0e-9231e1afbd24_removalai_preview%20%281%29-R3vkoRZjHg0GgKBUVR9hVcw9wbxZNG.png" 
                alt="Juiced Media" 
                className="relative h-10 w-auto rounded-lg shadow-lg" 
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Compliance Engine
              </span>
              <span className="text-xs text-slate-400 font-medium tracking-wide">
                Juiced Media
              </span>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="px-3 py-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1.5">
              {navigationItems.map((item) => {
                if (!item.items) {
                  // Single navigation item
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isPathActive(item.href!)}
                        className={`
                          group relative w-full rounded-xl transition-all duration-300 hover:scale-[1.02]
                          ${isPathActive(item.href!) 
                            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 shadow-lg shadow-blue-500/10' 
                            : 'hover:bg-slate-700/50 hover:shadow-md'
                          }
                        `}
                      >
                        <Link href={item.href!} className="flex items-center gap-2.5 px-3 py-2.5 min-h-[44px]">
                          <div className={`
                            p-1.5 rounded-md transition-all duration-300 flex-shrink-0
                            ${isPathActive(item.href!) 
                              ? 'bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg' 
                              : 'bg-slate-700/50 group-hover:bg-slate-600/50'
                            }
                          `}>
                            <item.icon className={`
                              h-4 w-4 transition-all duration-300
                              ${isPathActive(item.href!) ? 'text-white' : 'text-slate-300 group-hover:text-white'}
                            `} />
                          </div>
                          <span className={`
                            text-sm font-medium transition-all duration-300 flex-1 min-w-0 truncate
                            ${isPathActive(item.href!) 
                              ? 'text-white font-semibold' 
                              : 'text-slate-300 group-hover:text-white'
                            }
                          `}>
                            {item.title}
                          </span>
                          {isPathActive(item.href!) && (
                            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse flex-shrink-0" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                // Group with sub-items
                return (
                  <Collapsible
                    key={item.title}
                    defaultOpen={isGroupActive(item.items)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton 
                          className={`
                            group relative w-full rounded-xl transition-all duration-300 hover:scale-[1.02]
                            ${isGroupActive(item.items) 
                              ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 shadow-lg shadow-emerald-500/10' 
                              : 'hover:bg-slate-700/50 hover:shadow-md'
                            }
                          `}
                          isActive={isGroupActive(item.items)}
                        >
                          <div className="flex items-center gap-2.5 px-3 py-2.5 w-full min-h-[44px]">
                            <div className={`
                              p-1.5 rounded-md transition-all duration-300 flex-shrink-0
                              ${isGroupActive(item.items) 
                                ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg' 
                                : 'bg-slate-700/50 group-hover:bg-slate-600/50'
                              }
                            `}>
                              <item.icon className={`
                                h-4 w-4 transition-all duration-300
                                ${isGroupActive(item.items) ? 'text-white' : 'text-slate-300 group-hover:text-white'}
                              `} />
                            </div>
                            <span className={`
                              text-sm font-medium transition-all duration-300 flex-1 text-left min-w-0 truncate
                              ${isGroupActive(item.items) 
                                ? 'text-white font-semibold' 
                                : 'text-slate-300 group-hover:text-white'
                              }
                            `}>
                              {item.title}
                            </span>
                            <ChevronRight className={`
                              h-3.5 w-3.5 transition-all duration-300 group-data-[state=open]/collapsible:rotate-90 flex-shrink-0
                              ${isGroupActive(item.items) ? 'text-white' : 'text-slate-400 group-hover:text-white'}
                            `} />
                            {isGroupActive(item.items) && (
                              <div className="absolute right-6 h-2 w-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 animate-pulse" />
                            )}
                          </div>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1">
                        <SidebarMenuSub className="ml-4 mt-1 space-y-1 border-l border-slate-700/50 pl-3">
                          {item.items.map((subItem, index) => (
                            <SidebarMenuSubItem key={subItem.title} className="relative">
                              <div className="absolute -left-3 top-1/2 h-px w-2 bg-gradient-to-r from-slate-600 to-transparent" />
                              <SidebarMenuSubButton 
                                asChild
                                isActive={isPathActive(subItem.href)}
                                className={`
                                  group relative rounded-lg transition-all duration-300 hover:scale-[1.01]
                                  ${isPathActive(subItem.href) 
                                    ? 'bg-gradient-to-r from-indigo-500/20 to-pink-500/20 border border-indigo-500/30 shadow-md' 
                                    : 'hover:bg-slate-700/30 hover:shadow-sm'
                                  }
                                `}
                              >
                                <Link href={subItem.href} className="flex items-center gap-2 px-2.5 py-2 min-h-[36px]">
                                  <div className={`
                                    p-1 rounded transition-all duration-300 flex-shrink-0
                                    ${isPathActive(subItem.href) 
                                      ? 'bg-gradient-to-br from-indigo-500 to-pink-500 shadow-sm' 
                                      : 'bg-slate-700/30 group-hover:bg-slate-600/40'
                                    }
                                  `}>
                                    <subItem.icon className={`
                                      h-3 w-3 transition-all duration-300
                                      ${isPathActive(subItem.href) ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}
                                    `} />
                                  </div>
                                  <span className={`
                                    text-xs font-medium transition-all duration-300 flex-1 min-w-0 truncate
                                    ${isPathActive(subItem.href) 
                                      ? 'text-white font-semibold' 
                                      : 'text-slate-400 group-hover:text-slate-200'
                                    }
                                  `}>
                                    {subItem.title}
                                  </span>
                                  {isPathActive(subItem.href) && (
                                    <div className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-pink-400 animate-pulse flex-shrink-0" />
                                  )}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          
          {/* Cool animated divider */}
          <div className="px-3 py-3">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
          </div>
          
          {/* Status indicator */}
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <span className="text-xs font-medium text-slate-300">System Online</span>
            </div>
          </div>
        </SidebarContent>
        
        <SidebarRail className="bg-gradient-to-b from-slate-700 to-slate-800" />
      </div>
    </Sidebar>
  )
}
