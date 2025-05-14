import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react"

interface BatchStatusBadgeProps {
  status: "pending" | "processing" | "completed" | "failed"
  showIcon?: boolean
}

export function BatchStatusBadge({ status, showIcon = true }: BatchStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "completed":
        return {
          variant: "success" as const,
          icon: <CheckCircle className="h-3 w-3 mr-1" />,
          label: "Completed",
        }
      case "processing":
        return {
          variant: "default" as const,
          icon: <Clock className="h-3 w-3 mr-1" />,
          label: "Processing",
        }
      case "pending":
        return {
          variant: "outline" as const,
          icon: <Clock className="h-3 w-3 mr-1" />,
          label: "Pending",
        }
      case "failed":
        return {
          variant: "destructive" as const,
          icon: <XCircle className="h-3 w-3 mr-1" />,
          label: "Failed",
        }
      default:
        return {
          variant: "secondary" as const,
          icon: <AlertCircle className="h-3 w-3 mr-1" />,
          label: status,
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Badge variant={config.variant} className="capitalize">
      {showIcon && config.icon}
      {config.label}
    </Badge>
  )
}
