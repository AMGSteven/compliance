import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BatchStatusBadge } from "@/components/trustedform/batch-status-badge"
import type { BatchOperation } from "@/lib/types/trustedform"
import Link from "next/link"
import { CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react"

interface BatchOperationCardProps {
  batchOperation: BatchOperation
}

export function BatchOperationCard({ batchOperation }: BatchOperationCardProps) {
  const { id, type, status, totalItems, processedItems, successfulItems, failedItems, createdAt } = batchOperation

  const getStatusIcon = () => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "processing":
        return <Clock className="h-5 w-5 text-blue-500" />
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return "bg-green-50 border-green-200"
      case "processing":
        return "bg-blue-50 border-blue-200"
      case "pending":
        return "bg-yellow-50 border-yellow-200"
      case "failed":
        return "bg-red-50 border-red-200"
      default:
        return "bg-gray-50 border-gray-200"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getProgressPercentage = () => {
    if (totalItems === 0) return 0
    return Math.round((processedItems / totalItems) * 100)
  }

  return (
    <Card className={`overflow-hidden border ${getStatusColor()}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold flex items-center">
              {getStatusIcon()}
              <span className="ml-2 capitalize">{type} Batch</span>
            </h3>
            <p className="text-sm text-muted-foreground">Created: {formatDate(createdAt)}</p>
          </div>
          <BatchStatusBadge status={status} />
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress:</span>
            <span>
              {processedItems} / {totalItems} ({getProgressPercentage()}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${getProgressPercentage()}%` }}></div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Successful:</span>
            <span className="ml-1 font-medium text-green-600">{successfulItems}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Failed:</span>
            <span className="ml-1 font-medium text-red-600">{failedItems}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-white p-4 border-t">
        <Button asChild className="w-full">
          <Link href={`/trustedform/batch/${id}`}>View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
