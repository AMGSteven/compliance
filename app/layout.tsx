import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Link from "next/link"
import { AuthProvider } from "@/lib/context/auth-context"
import { UserNav } from "@/components/user-nav"

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
              <div className="container mx-auto flex h-16 items-center px-4 justify-between">
                <div className="flex items-center">
                  <Link href="/" className="font-bold text-xl bg-clip-text text-transparent bg-juiced-gradient">
                    Juiced Media Compliance
                  </Link>
                  <nav className="ml-6 flex gap-6">
                    <Link href="/" className="text-sm font-medium hover:text-juiced-teal transition-colors">
                      Dashboard
                    </Link>
                    <Link
                      href="/suppressions"
                      className="text-sm font-medium text-juiced-gray hover:text-juiced-blue transition-colors"
                    >
                      Suppressions
                    </Link>
                    <Link
                      href="/trustedform"
                      className="text-sm font-medium text-juiced-gray hover:text-juiced-blue transition-colors"
                    >
                      TrustedForm
                    </Link>
                    <Link
                      href="/lead-validation"
                      className="text-sm font-medium text-juiced-gray hover:text-juiced-blue transition-colors"
                    >
                      Lead Validation
                    </Link>
                    <Link
                      href="/api-docs"
                      className="text-sm font-medium text-juiced-gray hover:text-juiced-blue transition-colors"
                    >
                      API Docs
                    </Link>
                  </nav>
                </div>
                <UserNav />
              </div>
            </header>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
