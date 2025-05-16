// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';


import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Download, Plus, Search, Trash2, Edit, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Mock data for partners
const partners = [
  {
    id: "1",
    name: "Email Service Provider A",
    status: "active",
    complianceLevel: "enhanced",
    rateLimit: 500,
    createdAt: "2025-01-15",
    updatedAt: "2025-05-01",
  },
  {
    id: "2",
    name: "SMS Gateway B",
    status: "active",
    complianceLevel: "standard",
    rateLimit: 200,
    createdAt: "2025-02-10",
    updatedAt: "2025-04-20",
  },
  {
    id: "3",
    name: "Voice Platform C",
    status: "inactive",
    complianceLevel: "standard",
    rateLimit: 100,
    createdAt: "2025-01-05",
    updatedAt: "2025-03-15",
  },
  {
    id: "4",
    name: "Direct Mail Processor D",
    status: "active",
    complianceLevel: "custom",
    rateLimit: 50,
    createdAt: "2025-03-20",
    updatedAt: "2025-04-25",
  },
  {
    id: "5",
    name: "Lead Generation Platform E",
    status: "active",
    complianceLevel: "enhanced",
    rateLimit: 300,
    createdAt: "2025-02-15",
    updatedAt: "2025-05-02",
  },
  {
    id: "6",
    name: "CRM System F",
    status: "suspended",
    complianceLevel: "standard",
    rateLimit: 150,
    createdAt: "2025-01-25",
    updatedAt: "2025-04-10",
  },
  {
    id: "7",
    name: "Social Media Platform G",
    status: "active",
    complianceLevel: "enhanced",
    rateLimit: 400,
    createdAt: "2025-03-05",
    updatedAt: "2025-04-30",
  },
]

export default function PartnersPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Partner Management</h1>
            <p className="text-muted-foreground">Manage integration partners and their API access</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Partner
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add Partner</CardTitle>
          <CardDescription>Add a new integration partner to the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium">
                Partner Name
              </label>
              <Input id="name" placeholder="Partner name" />
            </div>
            <div>
              <label htmlFor="status" className="mb-2 block text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label htmlFor="complianceLevel" className="mb-2 block text-sm font-medium">
                Compliance Level
              </label>
              <select
                id="complianceLevel"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="standard">Standard</option>
                <option value="enhanced">Enhanced</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label htmlFor="rateLimit" className="mb-2 block text-sm font-medium">
                Rate Limit (requests/minute)
              </label>
              <Input id="rateLimit" type="number" placeholder="100" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button>Add Partner</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partners</CardTitle>
          <CardDescription>A list of all integration partners</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search partners..." className="pl-8" />
            </div>
            <Button variant="outline">Filter</Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Compliance Level</TableHead>
                  <TableHead>Rate Limit</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          partner.status === "active"
                            ? "default"
                            : partner.status === "inactive"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {partner.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{partner.complianceLevel}</TableCell>
                    <TableCell>{partner.rateLimit} req/min</TableCell>
                    <TableCell>{partner.updatedAt}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>View API Keys</DropdownMenuItem>
                          <DropdownMenuItem>View Webhooks</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing <strong>7</strong> of <strong>7</strong> partners
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
