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
  DollarSign,
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
      {
        title: "SUBID Bids",
        href: "/dashboard/subid-bids",
        icon: DollarSign,
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
  const [isHovered, setIsHovered] = React.useState(false)
  const [isManuallyExpanded, setIsManuallyExpanded] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  // Auto-collapse on mount (when page loads)
  React.useEffect(() => {
    setMounted(true)
    // Auto-collapse after a brief delay to allow initial render
    const timer = setTimeout(() => {
      setIsManuallyExpanded(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [pathname]) // Re-trigger when pathname changes

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

  // Determine if sidebar should be expanded
  const isExpanded = isHovered || isManuallyExpanded

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  const handleToggleClick = () => {
    setIsManuallyExpanded(!isManuallyExpanded)
  }

  return (
    <div 
      className={`
        fixed left-0 top-0 z-50 h-full transition-all duration-300 ease-in-out
        ${isExpanded ? 'w-64' : 'w-16'}
        ${!mounted ? 'w-64' : ''}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
      <div className="relative z-10 h-full flex flex-col">
        <div className="border-b border-slate-700/50 flex-shrink-0">
          <div className={`flex items-center px-4 py-3 transition-all duration-300 ${isExpanded ? 'gap-3' : 'justify-center'}`}>
            <div className="relative flex-shrink-0" onClick={handleToggleClick}>
              <div className="absolute inset-0 bg-blue-500/20 rounded-lg blur-sm" />
              <img 
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3e7ab034-c4d7-498f-bd0e-9231e1afbd24_removalai_preview%20%281%29-R3vkoRZjHg0GgKBUVR9hVcw9wbxZNG.png" 
                alt="Juiced Media" 
                className="relative h-10 w-auto rounded-lg shadow-lg cursor-pointer hover:scale-105 transition-transform" 
              />
            </div>
            <div className={`flex flex-col transition-all duration-300 overflow-hidden ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
              <span className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                Compliance Engine
              </span>
              <span className="text-xs text-slate-400 font-medium tracking-wide whitespace-nowrap">
                Juiced Media
              </span>
            </div>
          </div>
        </div>
        
        <div className="px-3 py-4 flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            {navigationItems.map((item) => {
              if (!item.items) {
                // Single navigation item
                return (
                  <div key={item.title}>
                    <Link 
                      href={item.href!} 
                      className={`
                        flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] w-full rounded-xl transition-all duration-300 hover:scale-[1.02] group
                        ${isPathActive(item.href!) 
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 shadow-lg shadow-blue-500/10' 
                          : 'hover:bg-slate-700/50 hover:shadow-md'
                        }
                      `}
                    >
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
                      {isExpanded && (
                        <span className={`
                          text-sm font-medium transition-all duration-300 flex-1 min-w-0 truncate
                          ${isPathActive(item.href!) 
                            ? 'text-white font-semibold' 
                            : 'text-slate-300 group-hover:text-white'
                          }
                        `}>
                          {item.title}
                        </span>
                      )}
                      {isPathActive(item.href!) && isExpanded && (
                        <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse flex-shrink-0" />
                      )}
                    </Link>
                  </div>
                )
              }

              // Group with sub-items
              return (
                <Collapsible
                  key={item.title}
                  defaultOpen={isGroupActive(item.items) && isExpanded}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger 
                    className={`
                      flex items-center gap-2.5 px-3 py-2.5 w-full min-h-[44px] rounded-xl transition-all duration-300 hover:scale-[1.02] group
                      ${isGroupActive(item.items) 
                        ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 shadow-lg shadow-emerald-500/10' 
                        : 'hover:bg-slate-700/50 hover:shadow-md'
                      }
                    `}
                  >
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
                    {isExpanded && (
                      <>
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
                      </>
                    )}
                    {isGroupActive(item.items) && isExpanded && (
                      <div className="absolute right-6 h-2 w-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 animate-pulse" />
                    )}
                  </CollapsibleTrigger>
                  {isExpanded && (
                    <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1">
                      <div className="ml-4 mt-1 space-y-1 border-l border-slate-700/50 pl-3">
                        {item.items.map((subItem) => (
                          <div key={subItem.title} className="relative">
                            <div className="absolute -left-3 top-1/2 h-px w-2 bg-gradient-to-r from-slate-600 to-transparent" />
                            <Link 
                              href={subItem.href}
                              className={`
                                flex items-center gap-2 px-2.5 py-2 min-h-[36px] rounded-lg transition-all duration-300 hover:scale-[1.01] group
                                ${isPathActive(subItem.href) 
                                  ? 'bg-gradient-to-r from-indigo-500/20 to-pink-500/20 border border-indigo-500/30 shadow-md' 
                                  : 'hover:bg-slate-700/30 hover:shadow-sm'
                                }
                              `}
                            >
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
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  )}
                </Collapsible>
              )
            })}
          </div>
          
          {/* Cool animated divider */}
          {isExpanded && (
            <div className="px-3 py-3">
              <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
            </div>
          )}
          
          {/* Status indicator */}
          {isExpanded && (
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                <span className="text-xs font-medium text-slate-300">System Online</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
