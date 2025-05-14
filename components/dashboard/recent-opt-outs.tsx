import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime, getChannelLabel } from "@/lib/utils"
import { Mail, Phone, MapPin } from "lucide-react"
import type { OptOutWithContact } from "@/lib/types"

interface RecentOptOutsProps {
  optOuts: OptOutWithContact[]
}

export function RecentOptOuts({ optOuts }: RecentOptOutsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Opt-Outs</CardTitle>
        <CardDescription>Latest opt-out events across all channels</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {optOuts.length === 0 ? (
            <p className="text-center text-muted-foreground">No recent opt-outs</p>
          ) : (
            optOuts.map((optOut) => {
              // Determine which identifier to display
              let identifier = "Unknown"
              let icon = <Mail className="h-4 w-4" />

              if (optOut.channel === "email" && optOut.contact.email) {
                identifier = optOut.contact.email
                icon = <Mail className="h-4 w-4" />
              } else if (["phone", "sms"].includes(optOut.channel) && optOut.contact.phone) {
                identifier = optOut.contact.phone
                icon = <Phone className="h-4 w-4" />
              } else if (optOut.channel === "postal" && optOut.contact.postal) {
                identifier = optOut.contact.postal
                icon = <MapPin className="h-4 w-4" />
              }

              return (
                <div className="flex items-center" key={optOut.id}>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-muted">{icon}</AvatarFallback>
                  </Avatar>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{identifier}</p>
                    <p className="text-sm text-muted-foreground">
                      {optOut.source} • {getChannelLabel(optOut.channel)} • {formatDateTime(optOut.opt_out_date)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
