import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizePhone(phone: string): string {
  // Basic normalization - remove non-numeric characters
  return phone.replace(/\D/g, "")
}

export function normalizePostal(postal: string): string {
  // Basic normalization - trim and uppercase
  return postal.trim().toUpperCase()
}

export function calculateComplianceRate(totalChecks: number, totalViolations: number): number {
  if (totalChecks === 0) return 100
  return 100 - (totalViolations / totalChecks) * 100
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}

export function getChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    email: "Email",
    phone: "Phone",
    sms: "SMS",
    postal: "Postal",
    all: "All Channels",
  }
  return labels[channel] || channel
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pass: "bg-green-100 text-green-800",
    fail: "bg-red-100 text-red-800",
    warning: "bg-yellow-100 text-yellow-800",
    valid: "bg-green-100 text-green-800",
    invalid: "bg-red-100 text-red-800",
    expired: "bg-yellow-100 text-yellow-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}
