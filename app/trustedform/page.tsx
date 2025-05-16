

"use client"

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileCheck, Layers, Search, Upload } from "lucide-react"
import Link from "next/link"

export default function TrustedFormPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">TrustedForm</h1>
        <p className="text-muted-foreground">Manage and verify TrustedForm certificates</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Manage Certificates</div>
            <p className="text-xs text-muted-foreground">View and verify TrustedForm certificates</p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/trustedform/certificates">
                  <Search className="mr-2 h-4 w-4" />
                  View Certificates
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Batch Operations</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Batch Processing</div>
            <p className="text-xs text-muted-foreground">Process multiple certificates at once</p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/trustedform/batch">
                  <Layers className="mr-2 h-4 w-4" />
                  Batch Operations
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Example Form</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">TrustedForm Example</div>
            <p className="text-xs text-muted-foreground">See TrustedForm in action with an example form</p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/trustedform/form-example">
                  <Upload className="mr-2 h-4 w-4" />
                  Try Example Form
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>TrustedForm Dashboard</CardTitle>
                <CardDescription>View certificate statistics and recent activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <Button asChild size="lg">
                    <Link href="/trustedform/dashboard">
                      <FileCheck className="mr-2 h-5 w-5" />
                      Go to Dashboard
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="analytics" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>TrustedForm Analytics</CardTitle>
                <CardDescription>View detailed analytics and reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <Button asChild size="lg">
                    <Link href="/trustedform/analytics">
                      <FileCheck className="mr-2 h-5 w-5" />
                      View Analytics
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
