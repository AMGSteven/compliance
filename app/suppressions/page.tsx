"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDateTime, getChannelLabel } from "@/lib/utils"
import type { OptOutWithContact } from "@/lib/types"
import { Search, Download, Plus, Trash2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function SuppressionsPage() {
  const [optOuts, setOptOuts] = useState<OptOutWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [usingMockData, setUsingMockData] = useState(false)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset page when search term changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearchTerm])

  // Fetch opt-outs
  useEffect(() => {
    async function fetchOptOuts() {
      setLoading(true)
      setError(null)

      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        })

        if (debouncedSearchTerm) {
          queryParams.set("search", debouncedSearchTerm)
        }

        const response = await fetch(`/api/v1/opt-outs?${queryParams.toString()}`, {
          headers: {
            "x-api-key": process.env.NEXT_PUBLIC_DIALER_API_KEY || "",
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`)
        }

        const data = await response.json()

        if (data._note && data._note.includes("mock")) {
          setUsingMockData(true)
        }

        setOptOuts(data.data || [])
        setTotal(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
      } catch (err) {
        console.error("Error fetching opt-outs:", err)
        setError("Failed to load suppression data. Using sample data instead.")
        setUsingMockData(true)

        // Generate mock data as fallback
        const mockOptOuts: OptOutWithContact[] = Array.from({ length: 10 }, (_, i) => ({
          id: `mock-${i}`,
          channel: ["email", "phone", "sms", "postal", "all"][Math.floor(Math.random() * 4)] as "email" | "phone" | "sms" | "postal" | "all",
          source: "Sample Data",
          opt_out_date: new Date().toISOString(),
          reason: undefined,
          contact_id: `contact-${i}`,
          created_at: new Date().toISOString(),
          contact: {
            id: `contact-${i}`,
            email: `user${i}@example.com`,
            phone: undefined,
            postal: undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }))

        setOptOuts(mockOptOuts as OptOutWithContact[])
        setTotal(25)
        setTotalPages(3)
      } finally {
        setLoading(false)
      }
    }

    fetchOptOuts()
  }, [page, limit, debouncedSearchTerm])

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1)
    }
  }

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1)
    }
  }

  if (loading && optOuts.length === 0) {
    return (
      <main className="container mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Suppressions</h1>
        <div className="flex items-center justify-center h-64">
          <p className="text-lg">Loading suppression data...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppressions</h1>
          <p className="text-muted-foreground">Manage opt-outs and suppressions across all channels</p>
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

      {usingMockData && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            Displaying sample data for preview purposes. Connect to a database for real data.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add Suppression</CardTitle>
          <CardDescription>Add a new contact to the suppression list</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="identifier" className="mb-2 block text-sm font-medium">
                Identifier
              </label>
              <Input id="identifier" placeholder="Email, phone, or postal address" />
            </div>
            <div>
              <label htmlFor="identifierType" className="mb-2 block text-sm font-medium">
                Identifier Type
              </label>
              <select
                id="identifierType"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="sms">SMS</option>
                <option value="postal">Postal</option>
              </select>
            </div>
            <div>
              <label htmlFor="channel" className="mb-2 block text-sm font-medium">
                Channel
              </label>
              <select
                id="channel"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="sms">SMS</option>
                <option value="postal">Postal</option>
                <option value="all">All Channels</option>
              </select>
            </div>
            <div>
              <label htmlFor="source" className="mb-2 block text-sm font-medium">
                Source
              </label>
              <Input id="source" placeholder="Source of opt-out" />
            </div>
            <div>
              <label htmlFor="reason" className="mb-2 block text-sm font-medium">
                Reason (optional)
              </label>
              <Input id="reason" placeholder="Reason for opt-out" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button>Add to Suppression List</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suppression List</CardTitle>
          <CardDescription>A list of all suppressed contacts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search suppressions..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline">Filter</Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optOuts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No suppressions found
                    </TableCell>
                  </TableRow>
                ) : (
                  optOuts.map((optOut) => {
                    // Determine which identifier to display
                    let identifier = "Unknown"

                    if (optOut.channel === "email" && optOut.contact.email) {
                      identifier = optOut.contact.email
                    } else if (["phone", "sms"].includes(optOut.channel) && optOut.contact.phone) {
                      identifier = optOut.contact.phone
                    } else if (optOut.channel === "postal" && optOut.contact.postal) {
                      identifier = optOut.contact.postal
                    }

                    return (
                      <TableRow key={optOut.id}>
                        <TableCell className="font-medium">{identifier}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getChannelLabel(optOut.channel)}</Badge>
                        </TableCell>
                        <TableCell>{optOut.source}</TableCell>
                        <TableCell>{formatDateTime(optOut.opt_out_date)}</TableCell>
                        <TableCell>{optOut.reason || "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing <strong>{optOuts.length}</strong> of <strong>{total}</strong> results
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={page <= 1 || loading}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={page >= totalPages || loading}>
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>
    </main>
  )
}
