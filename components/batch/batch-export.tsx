"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Loader2, Download, FileJson, FileSpreadsheet } from "lucide-react"
import { exportAsCSV, exportAsJSON } from "@/lib/utils/export-utils"
import { toast } from "@/components/ui/use-toast"

interface BatchExportProps {
  batchId: string
  disabled?: boolean
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}

export function BatchExport({ batchId, disabled = false, variant = "outline", size = "default" }: BatchExportProps) {
  const [loading, setLoading] = useState(false)

  const fetchBatchResults = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/batch/${batchId}/results`)

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      return data.results || []
    } catch (error) {
      console.error("Error fetching batch results:", error)
      toast({
        title: "Error",
        description: "Failed to fetch batch results for export",
        variant: "destructive",
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: "csv" | "json") => {
    try {
      const results = await fetchBatchResults()

      if (results.length === 0) {
        toast({
          title: "No Results",
          description: "There are no results to export",
          variant: "default",
        })
        return
      }

      // Format the results for export
      const exportData = results.map((result: any) => ({
        id: result.id,
        batchId: result.batch_operation_id,
        itemId: result.item_id,
        success: result.success,
        message: result.message,
        createdAt: result.created_at,
        ...result.data,
      }))

      // Export the data in the selected format
      if (format === "csv") {
        exportAsCSV(exportData, `batch-${batchId}-results.csv`)
        toast({
          title: "Export Successful",
          description: "Batch results exported as CSV",
          variant: "default",
        })
      } else {
        exportAsJSON(exportData, `batch-${batchId}-results.json`)
        toast({
          title: "Export Successful",
          description: "Batch results exported as JSON",
          variant: "default",
        })
      }
    } catch (error) {
      console.error("Error exporting batch results:", error)
      toast({
        title: "Export Failed",
        description: "Failed to export batch results",
        variant: "destructive",
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          <FileJson className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
