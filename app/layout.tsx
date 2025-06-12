import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Link from "next/link"
import { AuthProvider } from "@/lib/context/auth-context"
import LogoutButton from "@/components/logout-button"

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
          <div className="flex min-h-screen flex-col">
            <header className="border-b shadow-sm bg-white">
              <div className="container mx-auto flex h-16 items-center px-4">
                <div className="flex items-center flex-grow">
                  <Link href="/" className="h-8">
                    <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3e7ab034-c4d7-498f-bd0e-9231e1afbd24_removalai_preview%20%281%29-R3vkoRZjHg0GgKBUVR9hVcw9wbxZNG.png" alt="Juiced Media" className="h-full w-auto" />
                  </Link>
                  <nav className="ml-8 flex gap-6">
                    <Link href="/" className="nav-link active">
                      Dashboard
                    </Link>
                    <Link href="/leads/test" className="nav-link">
                      Add New Lead
                    </Link>
                    <Link href="/compliance" className="nav-link">
                      Multi Source Compliance
                    </Link>
                    <Link href="/dashboard/list-routings" className="nav-link">
                      List Routings
                    </Link>
                    <Link href="/dashboard/leads" className="nav-link">
                      Leads
                    </Link>
                    <Link href="/dashboard/revenue-tracking" className="nav-link">
                      Revenue Tracking
                    </Link>
                    <Link href="/docs/api" className="nav-link">
                      API Docs
                    </Link>
                  </nav>
                </div>
                <div className="ml-auto">
                  <LogoutButton />
                </div>
              </div>
            </header>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
