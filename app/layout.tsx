import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/context/auth-context"
import LogoutButton from "@/components/logout-button"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Juiced Media Compliance Engine",
  description: "Centralized platform for managing suppression lists and compliance validations",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white px-4">
                <SidebarTrigger className="mr-2" />
                <div className="flex items-center gap-2 flex-1">
                  <h1 className="text-lg font-semibold text-gray-900">Compliance Dashboard</h1>
                </div>
                <div className="flex items-center gap-2">
                  <LogoutButton />
                </div>
              </header>
              <div className="flex flex-1 flex-col">
                <main className="flex-1">
                  {children}
                </main>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
