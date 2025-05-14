import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ComplianceTest } from "@/components/testing/compliance-test"
import { SuppressionTest } from "@/components/testing/suppression-test"
import { ApiTest } from "@/components/testing/api-test"

export default function TestingPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Testing Dashboard</h1>
        <p className="text-muted-foreground">Test and verify the functionality of compliance and suppression systems</p>
      </div>

      <Tabs defaultValue="compliance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="compliance">Compliance Checker</TabsTrigger>
          <TabsTrigger value="suppression">Suppression Check</TabsTrigger>
          <TabsTrigger value="api">API Test Tool</TabsTrigger>
        </TabsList>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceTest />
        </TabsContent>

        <TabsContent value="suppression" className="mt-6">
          <SuppressionTest />
        </TabsContent>

        <TabsContent value="api" className="mt-6">
          <ApiTest />
        </TabsContent>
      </Tabs>
    </div>
  )
}
