import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/utils"
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react"

interface VerificationResultProps {
  verification: {
    id: string
    verificationResult: any
    matchStatus: boolean
    verifiedAt: string
    verifiedBy: string
  }
}

export function VerificationResult({ verification }: VerificationResultProps) {
  const result = verification.verificationResult

  // Determine the status icon
  let StatusIcon = AlertTriangle
  let statusColor = "text-yellow-500"
  let statusText = "Warning"

  if (verification.matchStatus && result.success) {
    StatusIcon = CheckCircle
    statusColor = "text-green-500"
    statusText = "Valid"
  } else if (!result.success) {
    StatusIcon = XCircle
    statusColor = "text-red-500"
    statusText = "Invalid"
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Verification Result</CardTitle>
          <div className={`flex items-center ${statusColor}`}>
            <StatusIcon className="mr-1 h-5 w-5" />
            <span className="font-medium">{statusText}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Verified by {verification.verifiedBy} on {formatDateTime(verification.verifiedAt)}
            </p>
          </div>

          {result.certificate && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Certificate Details</h3>
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Created:</span>{" "}
                    {result.certificate.created_at ? formatDateTime(result.certificate.created_at) : "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Expires:</span>{" "}
                    {result.certificate.expires_at ? formatDateTime(result.certificate.expires_at) : "N/A"}
                  </div>
                  {result.certificate.ip && (
                    <div>
                      <span className="font-medium">IP Address:</span> {result.certificate.ip}
                    </div>
                  )}
                  {result.certificate.page_url && (
                    <div className="col-span-2">
                      <span className="font-medium">Page URL:</span>{" "}
                      <span className="break-all">{result.certificate.page_url}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {result.certificate?.matching && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Lead Data Matching</h3>
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Email Match:</span> {result.certificate.matching.email ? "Yes" : "No"}
                  </div>
                  <div>
                    <span className="font-medium">Phone Match:</span> {result.certificate.matching.phone ? "Yes" : "No"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(result.warnings?.length > 0 || result.certificate?.warnings?.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Warnings</h3>
              <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                <ul className="list-disc pl-5 space-y-1">
                  {result.warnings?.map((warning: string, index: number) => (
                    <li key={`warning-${index}`}>{warning}</li>
                  ))}
                  {result.certificate?.warnings?.map((warning: string, index: number) => (
                    <li key={`cert-warning-${index}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {result.errors?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Errors</h3>
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                <ul className="list-disc pl-5 space-y-1">
                  {result.errors.map((error: string, index: number) => (
                    <li key={`error-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
