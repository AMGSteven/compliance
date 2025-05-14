/**
 * Calculate the next run date based on the schedule type
 */
export function calculateNextRunDate(scheduleType: string, cronExpression?: string): Date {
  const now = new Date()
  const nextRun = new Date(now)

  switch (scheduleType) {
    case "daily":
      // Set to next day, same time
      nextRun.setDate(nextRun.getDate() + 1)
      break

    case "weekly":
      // Set to next week, same day and time
      nextRun.setDate(nextRun.getDate() + 7)
      break

    case "monthly":
      // Set to next month, same day and time
      nextRun.setMonth(nextRun.getMonth() + 1)
      break

    case "custom":
      if (cronExpression) {
        // For custom schedules, we'd ideally use a cron parser library
        // This is a simplified version that just adds 1 day
        nextRun.setDate(nextRun.getDate() + 1)
      } else {
        // Default to daily if no cron expression is provided
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    default:
      // Default to daily
      nextRun.setDate(nextRun.getDate() + 1)
  }

  return nextRun
}

/**
 * Format a schedule type for display
 */
export function formatScheduleType(scheduleType: string, cronExpression?: string): string {
  switch (scheduleType) {
    case "daily":
      return "Daily"
    case "weekly":
      return "Weekly"
    case "monthly":
      return "Monthly"
    case "custom":
      return cronExpression ? `Custom (${cronExpression})` : "Custom"
    default:
      return scheduleType
  }
}
