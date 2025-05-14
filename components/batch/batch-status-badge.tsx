import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react"

interface BatchStatusBadgeProps {
  status: "pending" | "processing" | "completed" | "failed"
  showIcon?: boolean
  showLabel?: boolean
}

export function BatchStatusBadge({ status, showIcon = true, showLabel = true }: BatchStatusBadgeProps) {
  let icon = null
  const label = status
  let variant: "default" | "destructive" | "outline" | "secondary" | "success" | "warning" | null | undefined =
    "default"

  switch (status) {
    case "pending":
      icon = <Clock className="h-3 w-3" />
      variant = "secondary"
      break
    case "processing":
      icon = <Loader2 className="h-3 w-3 animate-spin" />
      variant = "default"
      break
    case "completed":
      icon = <CheckCircle className="h-3 w-3" />
      variant = "success"
      break
    case "failed":
      icon = <XCircle className="h-3 w-3" />
      variant = "destructive"
      break
  }

  return (
    <Badge variant={variant} className="capitalize">
      {showIcon && icon && <span className="mr-1">{icon}</span>}
      {showLabel && label}
    </Badge>
  )
}
