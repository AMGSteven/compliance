"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

export function MainNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname()

  return (
    <div className="mr-4 hidden md:flex">
      <Link href="/" className="mr-6 flex items-center space-x-2">
        <span className="hidden font-bold sm:inline-block">Suppression Engine</span>
      </Link>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <Link href="/" legacyBehavior passHref>
              <NavigationMenuLink className={navigationMenuTriggerStyle()}>Dashboard</NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Suppressions</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                <li className="row-span-3">
                  <NavigationMenuLink asChild>
                    <a
                      className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                      href="/suppressions"
                    >
                      <div className="mb-2 mt-4 text-lg font-medium">Suppression Lists</div>
                      <p className="text-sm leading-tight text-muted-foreground">
                        Manage your suppression lists and opt-outs
                      </p>
                    </a>
                  </NavigationMenuLink>
                </li>
                <ListItem href="/suppressions/email" title="Email Suppressions">
                  Manage email opt-outs and suppressions
                </ListItem>
                <ListItem href="/suppressions/phone" title="Phone Suppressions">
                  Manage phone opt-outs and suppressions
                </ListItem>
                <ListItem href="/lead-validation" title="Lead Validation">
                  Validate leads against suppression lists
                </ListItem>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Compliance</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                <li className="row-span-3">
                  <NavigationMenuLink asChild>
                    <a
                      className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                      href="/trustedform"
                    >
                      <div className="mb-2 mt-4 text-lg font-medium">Compliance Tools</div>
                      <p className="text-sm leading-tight text-muted-foreground">
                        Ensure compliance with regulations and best practices
                      </p>
                    </a>
                  </NavigationMenuLink>
                </li>
                <ListItem href="/trustedform" title="TrustedForm">
                  Manage TrustedForm certificates and verifications
                </ListItem>
                <ListItem href="/tcpa" title="TCPA Compliance">
                  Check phone numbers against TCPA litigator lists
                </ListItem>
                <ListItem href="/batch" title="Batch Operations">
                  Process multiple compliance checks at once
                </ListItem>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>TrustedForm</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                <li className="row-span-3">
                  <NavigationMenuLink asChild>
                    <a
                      className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                      href="/trustedform"
                    >
                      <div className="mb-2 mt-4 text-lg font-medium">TrustedForm</div>
                      <p className="text-sm leading-tight text-muted-foreground">
                        Manage TrustedForm certificates and verifications
                      </p>
                    </a>
                  </NavigationMenuLink>
                </li>
                <ListItem href="/trustedform/certificates" title="Certificates">
                  View and manage TrustedForm certificates
                </ListItem>
                <ListItem href="/trustedform/verify" title="Verify Certificate">
                  Verify a TrustedForm certificate
                </ListItem>
                <ListItem href="/trustedform/batch" title="Batch Operations">
                  Process multiple certificates at once
                </ListItem>
                <ListItem href="/trustedform/form-example" title="Form Example">
                  Example form with TrustedForm integration
                </ListItem>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>API & Docs</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                <ListItem href="/docs/api" title="API Documentation">
                  Learn how to use our API
                </ListItem>
                <ListItem href="/docs/external-api" title="External API">
                  Documentation for external API integrations
                </ListItem>
                <ListItem href="/webhooks" title="Webhooks">
                  Configure webhook notifications
                </ListItem>
                <ListItem href="/webhooks/events" title="Webhook Events">
                  Explore available webhook events
                </ListItem>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/partners" legacyBehavior passHref>
              <NavigationMenuLink className={navigationMenuTriggerStyle()}>Partners</NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}

const ListItem = React.forwardRef<React.ElementRef<"a">, React.ComponentPropsWithoutRef<"a">>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <li>
        <NavigationMenuLink asChild>
          <a
            ref={ref}
            className={cn(
              "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              className,
            )}
            {...props}
          >
            <div className="text-sm font-medium leading-none">{title}</div>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{children}</p>
          </a>
        </NavigationMenuLink>
      </li>
    )
  },
)
ListItem.displayName = "ListItem"
