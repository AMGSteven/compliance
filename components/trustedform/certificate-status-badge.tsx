import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, Clock } from "lucide-react"

interface CertificateStatusBadgeProps {
  status: string
}

export function CertificateStatusBadge({ status }: CertificateStatusBadgeProps) {
  switch (status.toLowerCase()) {
    case "verified":
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          <span>Verified</span>
        </Badge>
      )
    case "invalid":
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          <span>Invalid</span>
        </Badge>
      )
    case "pending":
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Pending</span>
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <span>{status}</span>
        </Badge>
      )
  }
}
