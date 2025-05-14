import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LeadValidationPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center">
        <Button variant="outline" size="icon" className="mr-4" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Validation</h1>
          <p className="text-muted-foreground">Validate leads for compliance with regulatory requirements</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Validate Lead</CardTitle>
            <CardDescription>Enter lead information to validate compliance</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="trustedform" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="trustedform">TrustedForm</TabsTrigger>
                <TabsTrigger value="tcpa">TCPA Consent</TabsTrigger>
                <TabsTrigger value="leadage">Lead Age</TabsTrigger>
              </TabsList>
              <TabsContent value="trustedform" className="space-y-4 pt-4">
                <div>
                  <label htmlFor="certificateUrl" className="mb-2 block text-sm font-medium">
                    TrustedForm Certificate URL
                  </label>
                  <Input id="certificateUrl" placeholder="https://cert.trustedform.com/..." />
                </div>
                <div>
                  <label htmlFor="leadId" className="mb-2 block text-sm font-medium">
                    Lead ID (optional)
                  </label>
                  <Input id="leadId" placeholder="Lead identifier" />
                </div>
                <div className="flex justify-end">
                  <Button>Validate Certificate</Button>
                </div>
              </TabsContent>
              <TabsContent value="tcpa" className="space-y-4 pt-4">
                <div>
                  <label htmlFor="consentText" className="mb-2 block text-sm font-medium">
                    Consent Text
                  </label>
                  <Textarea id="consentText" placeholder="I consent to receive calls and text messages..." rows={3} />
                </div>
                <div>
                  <label htmlFor="consentTimestamp" className="mb-2 block text-sm font-medium">
                    Consent Timestamp
                  </label>
                  <Input id="consentTimestamp" type="datetime-local" />
                </div>
                <div>
                  <label htmlFor="consentMethod" className="mb-2 block text-sm font-medium">
                    Consent Method
                  </label>
                  <select
                    id="consentMethod"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="checkbox">Checkbox</option>
                    <option value="signature">E-Signature</option>
                    <option value="clickwrap">Clickwrap Agreement</option>
                    <option value="verbal">Verbal (Recorded)</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <Button>Validate Consent</Button>
                </div>
              </TabsContent>
              <TabsContent value="leadage" className="space-y-4 pt-4">
                <div>
                  <label htmlFor="createdAt" className="mb-2 block text-sm font-medium">
                    Lead Creation Timestamp
                  </label>
                  <Input id="createdAt" type="datetime-local" />
                </div>
                <div>
                  <label htmlFor="maxAge" className="mb-2 block text-sm font-medium">
                    Maximum Age (hours)
                  </label>
                  <Input id="maxAge" type="number" placeholder="72" />
                </div>
                <div className="flex justify-end">
                  <Button>Validate Age</Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription>Results will appear here after validation</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] overflow-y-auto">
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <div className="mb-2 flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                  <h3 className="font-medium">TrustedForm Certificate Valid</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Certificate: https://cert.trustedform.com/2b1cb000fd39cf01c66513cb37175985c28c955e</p>
                  <p>Created: May 7, 2025 at 10:15 AM</p>
                  <p>Expires: June 6, 2025 at 10:15 AM</p>
                  <p>IP Address: 192.168.1.1</p>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <div className="mb-2 flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
                  <h3 className="font-medium">TCPA Consent Warning</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Consent text does not explicitly mention SMS messages</p>
                  <p>Consent Method: Checkbox</p>
                  <p>Timestamp: May 6, 2025 at 3:45 PM</p>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <div className="mb-2 flex items-center">
                  <XCircle className="mr-2 h-5 w-5 text-red-500" />
                  <h3 className="font-medium">Lead Age Invalid</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Lead age (96.3 hours) exceeds maximum allowed (72 hours)</p>
                  <p>Created: May 3, 2025 at 11:20 AM</p>
                  <p>Current Age: 4.01 days</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/50 px-6 py-3">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
                <span className="font-medium">Lead has validation warnings</span>
              </div>
              <Button variant="outline" size="sm">
                Export Results
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Batch Validation</CardTitle>
          <CardDescription>Upload a CSV file to validate multiple leads at once</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center rounded-md border border-dashed p-8">
            <div className="text-center">
              <div className="mb-2 text-muted-foreground">
                <svg
                  className="mx-auto h-12 w-12"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="mb-2 text-lg font-medium">Upload CSV File</div>
              <p className="mb-4 text-sm text-muted-foreground">Drag and drop a CSV file here, or click to browse</p>
              <Button variant="outline">Select File</Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Supported format: CSV with columns for lead ID, TrustedForm URL, consent text, and timestamps
          </div>
          <Button disabled>Upload and Validate</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
