// src/app/availability/page.tsx or similar
import React, { useState } from 'react'
import { addMinutes, format } from 'date-fns'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import LeaveManagement from '@/components/availability/Leavemanagement'
import AvailabilityTable from '@/components/availability/AvailabilityTable'
import { useAuth } from '@/contexts/AuthContext'
import AdminLeave from '@/components/availability/AdminLeave'
import AvailibilitySlot from '@/components/availability/AvailibilitySlot'

const Availability = () => {
    const { user, isLoading } = useAuth()
    const [open, setOpen] = useState(false)

    if (isLoading) {
        return <div className="text-center py-10">Loading...</div>
    }

    const formatTime = (date: Date) => format(date, 'h.mm a').toUpperCase().replace('AM', 'am').replace('PM', 'pm')
    
    const timeSlots = (() => {
        const slots: string[] = []
        let current = new Date(2000, 0, 1, 4, 0) // 4:00 AM
        const midnight = new Date(2000, 0, 2, 0, 0) // Next day 12:00 AM
        while (current < midnight) {
            const end = addMinutes(current, 60)
            slots.push(`${formatTime(current)} - ${formatTime(end)}`)
            current = end
        }
        return slots
    })()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Availability Management</h1>
                    <p className="text-muted-foreground mt-1">Manage your weekly work availability and leaves</p>
                </div>

                {user?.role === 'admin' && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button size="lg">
                                <Plus className="h-5 w-5 mr-2" />
                                Set Your Availability
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-7xl h-[90vh] overflow-y-auto">
                            <DialogTitle className="text-2xl">Set My Availability</DialogTitle>
                            <div className="mt-6 space-y-8">
                                <LeaveManagement timeSlots={timeSlots} />
                                <AvailabilityTable timeSlots={timeSlots} />
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Staff View */}
            {user && (user.role === 'operationsstaff' || user.role === 'itteam') && (
                <div className="space-y-8">
                    <LeaveManagement timeSlots={timeSlots} />
                    <AvailabilityTable timeSlots={timeSlots} />
                </div>
            )}

            {/* Admin View */}
            {user?.role === 'admin' && !open && (
                <div className="space-y-8 mt-10">
                    <AdminLeave />
                    <AvailibilitySlot />
                </div>
            )}
        </div>
    )
}

export default Availability