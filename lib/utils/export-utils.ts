/**
 * Utility functions for exporting data to different formats
 */

// Convert an array of objects to CSV
export function objectsToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return ""
  }

  // Get all unique keys from all objects
  const keys = Array.from(
    new Set(
      data.reduce((allKeys: string[], obj) => {
        return [...allKeys, ...Object.keys(obj)]
      }, []),
    ),
  )

  // Create CSV header row
  const header = keys.join(",")

  // Create CSV data rows
  const rows = data.map((obj) => {
    return keys
      .map((key) => {
        const value = obj[key]
        // Handle different value types
        if (value === null || value === undefined) {
          return ""
        } else if (typeof value === "object") {
          // Convert objects to JSON strings and escape quotes
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`
        } else if (typeof value === "string") {
          // Escape quotes in strings
          return `"${value.replace(/"/g, '""')}"`
        } else {
          return value
        }
      })
      .join(",")
  })

  // Combine header and rows
  return [header, ...rows].join("\n")
}

// Convert an array of objects to JSON
export function objectsToJSON(data: any[]): string {
  return JSON.stringify(data, null, 2)
}

// Flatten nested objects for CSV export
export function flattenObject(obj: any, prefix = ""): any {
  return Object.keys(obj).reduce((acc: any, key) => {
    const pre = prefix.length ? `${prefix}.` : ""
    if (
      typeof obj[key] === "object" &&
      obj[key] !== null &&
      !Array.isArray(obj[key]) &&
      Object.keys(obj[key]).length > 0
    ) {
      Object.assign(acc, flattenObject(obj[key], `${pre}${key}`))
    } else if (Array.isArray(obj[key])) {
      acc[`${pre}${key}`] = JSON.stringify(obj[key])
    } else {
      acc[`${pre}${key}`] = obj[key]
    }
    return acc
  }, {})
}

// Create a downloadable blob and trigger download
export function downloadBlob(content: string, filename: string, contentType: string): void {
  if (typeof window === "undefined") {
    return // Server-side rendering check
  }

  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Export data as CSV file
export function exportAsCSV(data: any[], filename: string): void {
  // Flatten nested objects for better CSV format
  const flattenedData = data.map((item) => flattenObject(item))
  const csv = objectsToCSV(flattenedData)
  downloadBlob(csv, filename, "text/csv;charset=utf-8;")
}

// Export data as JSON file
export function exportAsJSON(data: any[], filename: string): void {
  const json = objectsToJSON(data)
  downloadBlob(json, filename, "application/json;charset=utf-8;")
}
