import { BatchResults } from "@/components/tcpa/batch-results"

export default function BatchResultPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">TCPA Batch Results</h1>
        <p className="text-muted-foreground">View the results of your TCPA compliance batch check</p>
      </div>

      <BatchResults batchId={params.id} />
    </div>
  )
}
