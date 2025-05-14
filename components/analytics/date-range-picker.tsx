"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format, isValid, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useEffect, useState } from "react"

interface DateRangePickerProps {
  startDate: Date
  endDate: Date
  onRangeChange: (startDate: Date, endDate: Date) => void
  className?: string
}

export function DateRangePicker({ startDate, endDate, onRangeChange, className }: DateRangePickerProps) {
  const [isStartOpen, setIsStartOpen] = useState(false)
  const [isEndOpen, setIsEndOpen] = useState(false)

  // Create local state to track selected dates before applying them
  const [localStartDate, setLocalStartDate] = useState<Date>(startDate)
  const [localEndDate, setLocalEndDate] = useState<Date>(endDate)

  // State for text inputs
  const [startDateText, setStartDateText] = useState(format(startDate, "MM/dd/yyyy"))
  const [endDateText, setEndDateText] = useState(format(endDate, "MM/dd/yyyy"))
  const [startDateError, setStartDateError] = useState(false)
  const [endDateError, setEndDateError] = useState(false)

  // Update text inputs when dates change from outside
  useEffect(() => {
    setStartDateText(format(startDate, "MM/dd/yyyy"))
    setLocalStartDate(startDate)
  }, [startDate])

  useEffect(() => {
    setEndDateText(format(endDate, "MM/dd/yyyy"))
    setLocalEndDate(endDate)
  }, [endDate])

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      // Update local state first
      setLocalStartDate(date)
      setStartDateText(format(date, "MM/dd/yyyy"))
      setStartDateError(false)

      // If the selected start date is after the current end date,
      // adjust the end date to match the start date
      const newEndDate = date > localEndDate ? date : localEndDate
      if (date > localEndDate) {
        setLocalEndDate(date)
        setEndDateText(format(date, "MM/dd/yyyy"))
      }

      // Apply the changes
      onRangeChange(date, newEndDate)

      // Close the popover
      setIsStartOpen(false)
    }
  }

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      // Update local state first
      setLocalEndDate(date)
      setEndDateText(format(date, "MM/dd/yyyy"))
      setEndDateError(false)

      // If the selected end date is before the current start date,
      // adjust the start date to match the end date
      const newStartDate = date < localStartDate ? date : localStartDate
      if (date < localStartDate) {
        setLocalStartDate(date)
        setStartDateText(format(date, "MM/dd/yyyy"))
      }

      // Apply the changes
      onRangeChange(newStartDate, date)

      // Close the popover
      setIsEndOpen(false)
    }
  }

  const handleStartDateTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setStartDateText(text)

    // Parse the date
    const parsedDate = parse(text, "MM/dd/yyyy", new Date())

    if (isValid(parsedDate)) {
      setStartDateError(false)
      setLocalStartDate(parsedDate)

      // If the entered start date is after the current end date,
      // adjust the end date to match the start date
      if (parsedDate > localEndDate) {
        setLocalEndDate(parsedDate)
        setEndDateText(format(parsedDate, "MM/dd/yyyy"))
        onRangeChange(parsedDate, parsedDate)
      } else {
        onRangeChange(parsedDate, localEndDate)
      }
    } else {
      setStartDateError(true)
    }
  }

  const handleEndDateTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setEndDateText(text)

    // Parse the date
    const parsedDate = parse(text, "MM/dd/yyyy", new Date())

    if (isValid(parsedDate)) {
      setEndDateError(false)
      setLocalEndDate(parsedDate)

      // If the entered end date is before the current start date,
      // adjust the start date to match the end date
      if (parsedDate < localStartDate) {
        setLocalStartDate(parsedDate)
        setStartDateText(format(parsedDate, "MM/dd/yyyy"))
        onRangeChange(parsedDate, parsedDate)
      } else {
        onRangeChange(localStartDate, parsedDate)
      }
    } else {
      setEndDateError(true)
    }
  }

  // Handle blur events to validate and format the date
  const handleStartDateBlur = () => {
    try {
      const parsedDate = parse(startDateText, "MM/dd/yyyy", new Date())
      if (isValid(parsedDate)) {
        setStartDateText(format(parsedDate, "MM/dd/yyyy"))
        setStartDateError(false)
      } else {
        // Reset to the current valid date
        setStartDateText(format(localStartDate, "MM/dd/yyyy"))
        setStartDateError(false)
      }
    } catch (error) {
      // Reset to the current valid date
      setStartDateText(format(localStartDate, "MM/dd/yyyy"))
      setStartDateError(false)
    }
  }

  const handleEndDateBlur = () => {
    try {
      const parsedDate = parse(endDateText, "MM/dd/yyyy", new Date())
      if (isValid(parsedDate)) {
        setEndDateText(format(parsedDate, "MM/dd/yyyy"))
        setEndDateError(false)
      } else {
        // Reset to the current valid date
        setEndDateText(format(localEndDate, "MM/dd/yyyy"))
        setEndDateError(false)
      }
    } catch (error) {
      // Reset to the current valid date
      setEndDateText(format(localEndDate, "MM/dd/yyyy"))
      setEndDateError(false)
    }
  }

  // Predefined ranges
  const setLastWeek = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 7)

    // Update local state
    setLocalStartDate(start)
    setLocalEndDate(end)
    setStartDateText(format(start, "MM/dd/yyyy"))
    setEndDateText(format(end, "MM/dd/yyyy"))
    setStartDateError(false)
    setEndDateError(false)

    // Apply the changes
    onRangeChange(start, end)
  }

  const setLastMonth = () => {
    const end = new Date()
    const start = new Date()
    start.setMonth(end.getMonth() - 1)

    // Update local state
    setLocalStartDate(start)
    setLocalEndDate(end)
    setStartDateText(format(start, "MM/dd/yyyy"))
    setEndDateText(format(end, "MM/dd/yyyy"))
    setStartDateError(false)
    setEndDateError(false)

    // Apply the changes
    onRangeChange(start, end)
  }

  const setLastQuarter = () => {
    const end = new Date()
    const start = new Date()
    start.setMonth(end.getMonth() - 3)

    // Update local state
    setLocalStartDate(start)
    setLocalEndDate(end)
    setStartDateText(format(start, "MM/dd/yyyy"))
    setEndDateText(format(end, "MM/dd/yyyy"))
    setStartDateError(false)
    setEndDateError(false)

    // Apply the changes
    onRangeChange(start, end)
  }

  return (
    <div className={cn("flex flex-col sm:flex-row gap-2", className)}>
      <div className="flex gap-2 items-center">
        <div className="flex flex-col">
          <div className="flex items-center">
            <Input
              type="text"
              value={startDateText}
              onChange={handleStartDateTextChange}
              onBlur={handleStartDateBlur}
              className={cn("w-[120px]", startDateError && "border-red-500 focus-visible:ring-red-500")}
              placeholder="MM/DD/YYYY"
            />
            <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="ml-1 px-2 h-10" onClick={() => setIsStartOpen(true)}>
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={localStartDate}
                  onSelect={handleStartDateSelect}
                  initialFocus
                  defaultMonth={localStartDate}
                />
              </PopoverContent>
            </Popover>
          </div>
          {startDateError && <p className="text-xs text-red-500 mt-1">Please enter a valid date (MM/DD/YYYY)</p>}
        </div>

        <span className="mx-2">to</span>

        <div className="flex flex-col">
          <div className="flex items-center">
            <Input
              type="text"
              value={endDateText}
              onChange={handleEndDateTextChange}
              onBlur={handleEndDateBlur}
              className={cn("w-[120px]", endDateError && "border-red-500 focus-visible:ring-red-500")}
              placeholder="MM/DD/YYYY"
            />
            <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="ml-1 px-2 h-10" onClick={() => setIsEndOpen(true)}>
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={localEndDate}
                  onSelect={handleEndDateSelect}
                  initialFocus
                  defaultMonth={localEndDate}
                />
              </PopoverContent>
            </Popover>
          </div>
          {endDateError && <p className="text-xs text-red-500 mt-1">Please enter a valid date (MM/DD/YYYY)</p>}
        </div>
      </div>

      <div className="flex gap-2 mt-2 sm:mt-0">
        <Button variant="outline" size="sm" onClick={setLastWeek}>
          Last Week
        </Button>
        <Button variant="outline" size="sm" onClick={setLastMonth}>
          Last Month
        </Button>
        <Button variant="outline" size="sm" onClick={setLastQuarter}>
          Last Quarter
        </Button>
      </div>
    </div>
  )
}
