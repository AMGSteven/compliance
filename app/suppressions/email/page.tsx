// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';


import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Download, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"

// Mock data for email suppressions
const emailSuppressions = [
  { id: "1", email: "optout1@example.com", source: "Unsubscribe Link", date: "2025-05-01", reason: "User request" },
  {
    id: "2",
    email: "optout2@example.com",
    source: "Preference Center",
    date: "2025-04-28",
    reason: "No longer interested",
  },
  { id: "3", email: "optout3@example.com", source: "Reply to Campaign", date: "2025-04-25", reason: "Unsubscribe" },
  {
    id: "4",
    email: "optout4@example.com",
    source: "Manual Entry",
    date: "2025-04-22",
    reason: "Customer service request",
  },
  { id: "5", email: "optout5@example.com", source: "Unsubscribe Link", date: "2025-04-20", reason: "Too many emails" },
  { id: "6", email: "optout6@example.com", source: "API", date: "2025-04-18", reason: "User request" },
  {
    id: "7",
    email: "optout7@example.com",
    source: "Preference Center",
    date: "2025-04-15",
    reason: "No longer interested",
  },
  { id: "8", email: "optout8@example.com", source: "Bounce", date: "2025-04-12", reason: "Hard bounce" },
  { id: "9", email: "optout9@example.com", source: "Spam Complaint", date: "2025-04-10", reason: "Marked as spam" },
  {
    id: "10",
    email: "optout10@example.com",
    source: "Manual Entry",
    date: "2025-04-08",
    reason: "Customer service request",
  },
]

export default function EmailSuppressionsPage() {
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
            <h1 className="text-2xl font-bold tracking-tight">Email Suppressions</h1>
            <p className="text-muted-foreground">Manage email opt-outs and suppressions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Suppression
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add Email Suppression</CardTitle>
          <CardDescription>Add a new email address to the suppression list</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                Email Address
              </label>
              <Input id="email" placeholder="user@example.com" />
            </div>
            <div>
              <label htmlFor="source" className="mb-2 block text-sm font-medium">
                Source
              </label>
              <select
                id="source"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="manual">Manual Entry</option>
                <option value="api">API</option>
                <option value="preference">Preference Center</option>
                <option value="unsubscribe">Unsubscribe Link</option>
                <option value="bounce">Bounce</option>
                <option value="complaint">Spam Complaint</option>
              </select>
            </div>
            <div>
              <label htmlFor="reason" className="mb-2 block text-sm font-medium">
                Reason
              </label>
              <Input id="reason" placeholder="Reason for suppression" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button>Add to Suppression List</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Suppression List</CardTitle>
          <CardDescription>A list of all suppressed email addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search emails..." className="pl-8" />
            </div>
            <Button variant="outline">Filter</Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailSuppressions.map((suppression) => (
                  <TableRow key={suppression.id}>
                    <TableCell className="font-medium">{suppression.email}</TableCell>
                    <TableCell>{suppression.source}</TableCell>
                    <TableCell>{suppression.date}</TableCell>
                    <TableCell>{suppression.reason}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing <strong>10</strong> of <strong>142,567</strong> results
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
