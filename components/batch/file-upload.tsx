"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, FileText, Loader2, Upload } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface FileUploadProps {
  onUpload: (data: any[]) => void
  title?: string
  description?: string
  acceptedFileTypes?: string
  maxFileSize?: number // in MB
  maxRows?: number
  requiredColumns?: string[]
  onError?: (error: string) => void
}

export function FileUpload({
  onUpload,
  title = "Upload File",
  description = "Upload a CSV or JSON file to process in batch",
  acceptedFileTypes = ".csv,.json",
  maxFileSize = 10, // 10MB
  maxRows = 1000,
  requiredColumns = [],
  onError,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setError(null)

    if (!selectedFile) {
      return
    }

    // Check file size
    if (selectedFile.size > maxFileSize * 1024 * 1024) {
      setError(`File size exceeds the maximum limit of ${maxFileSize}MB`)
      return
    }

    // Check file type
    const fileType = selectedFile.name.split(".").pop()?.toLowerCase()
    if (fileType !== "csv" && fileType !== "json") {
      setError("Only CSV and JSON files are supported")
      return
    }

    setFile(selectedFile)
  }

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n")
    if (lines.length === 0) {
      throw new Error("File is empty")
    }

    // Parse header row
    const headers = lines[0].split(",").map((header) => header.trim().replace(/^"(.*)"$/, "$1"))

    // Check required columns
    for (const requiredColumn of requiredColumns) {
      if (!headers.includes(requiredColumn)) {
        throw new Error(`Required column "${requiredColumn}" is missing`)
      }
    }

    // Parse data rows
    const data: any[] = []
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "") continue

      const values = lines[i].split(",").map((value) => value.trim().replace(/^"(.*)"$/, "$1"))
      if (values.length !== headers.length) {
        throw new Error(`Row ${i} has ${values.length} columns, but header has ${headers.length} columns`)
      }

      const row: any = {}
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j]
      }
      data.push(row)

      // Update progress
      setProgress(Math.round((i / lines.length) * 100))
    }

    return data
  }

  const parseJSON = (text: string): any[] => {
    const data = JSON.parse(text)
    if (!Array.isArray(data)) {
      throw new Error("JSON file must contain an array of objects")
    }

    // Check required columns
    for (const requiredColumn of requiredColumns) {
      if (!data.every((item) => requiredColumn in item)) {
        throw new Error(`Required column "${requiredColumn}" is missing in some items`)
      }
    }

    return data
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload")
      return
    }

    setLoading(true)
    setError(null)
    setProgress(0)

    try {
      const fileType = file.name.split(".").pop()?.toLowerCase()
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          let data: any[]

          if (fileType === "csv") {
            data = parseCSV(text)
          } else if (fileType === "json") {
            data = parseJSON(text)
          } else {
            throw new Error("Unsupported file type")
          }

          // Check number of rows
          if (data.length > maxRows) {
            throw new Error(`File contains ${data.length} rows, but the maximum allowed is ${maxRows}`)
          }

          // Success
          onUpload(data)
          setFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Failed to parse file"
          setError(errorMessage)
          if (onError) {
            onError(errorMessage)
          }
        } finally {
          setLoading(false)
        }
      }

      reader.onerror = () => {
        setError("Failed to read file")
        setLoading(false)
        if (onError) {
          onError("Failed to read file")
        }
      }

      reader.readAsText(file)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during upload"
      setError(errorMessage)
      setLoading(false)
      if (onError) {
        onError(errorMessage)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="file">{file ? file.name : "Choose a file"}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="file"
              type="file"
              accept={acceptedFileTypes}
              onChange={handleFileChange}
              ref={fileInputRef}
              className="cursor-pointer"
            />
          </div>
          {file && (
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)}MB • {file.type || "Unknown type"}
            </p>
          )}
        </div>

        {loading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Processing file...</span>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {file && !loading && (
          <div className="rounded-md bg-muted p-3">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)}MB • {file.type || "Unknown type"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpload} disabled={!file || loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload and Process
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
