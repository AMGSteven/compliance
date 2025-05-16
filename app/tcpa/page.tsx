// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';


import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PhoneCheckForm } from "@/components/tcpa/phone-check-form"
import { BatchCheckForm } from "@/components/tcpa/batch-check-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TCPAPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">TCPA Compliance</h1>
        <p className="text-muted-foreground">
          Check phone numbers against the TCPA Litigator List to ensure compliance
        </p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Single Check</TabsTrigger>
          <TabsTrigger value="batch">Batch Check</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="mt-4">
          <PhoneCheckForm />
        </TabsContent>
        <TabsContent value="batch" className="mt-4">
          <BatchCheckForm />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>About TCPA Compliance</CardTitle>
          <CardDescription>Understanding the Telephone Consumer Protection Act</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            The Telephone Consumer Protection Act (TCPA) is a federal law that restricts telemarketing calls, automatic
            telephone dialing systems, and artificial or prerecorded voice messages. The TCPA also applies to text
            messages and faxes.
          </p>
          <p>
            Our TCPA compliance checker helps you identify phone numbers associated with known TCPA litigators and
            complainers, reducing your risk of costly lawsuits and regulatory actions.
          </p>
          <h3 className="text-lg font-semibold mt-4">What We Check</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>TCPA Litigators</strong>: Individuals who have previously filed TCPA lawsuits
            </li>
            <li>
              <strong>TCPA Trolls</strong>: Serial litigators who actively seek out TCPA violations to file lawsuits
            </li>
            <li>
              <strong>DNC Complainers</strong>: Individuals who have filed Do Not Call complaints
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
