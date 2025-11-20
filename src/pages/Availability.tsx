import React, { useState, useEffect, useRef, useCallback } from 'react'
import { User } from 'firebase/auth'
import { addMinutes, format } from 'date-fns'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import LeaveManagement from '../components/availability/Leavemanagement'
import AvailabilityTable from '../components/availability/AvailabilityTable'
import { useAuth } from '@/contexts/AuthContext'
import AdminLeave from '@/components/availability/AdminLeave'
import AvailibilitySlot from '@/components/availability/AvailibilitySlot'

const Availability = () => {
    const { user, isLoading } = useAuth()
    const [open, setOpen] = useState(false)

    if (isLoading) {
        return <div>Loading...</div> 
    }

    const formatTime = (date: Date) => format(date, 'h:mm a').replace(/:/g, '.').replace(/\s/g, '').toUpperCase()
    const timeSlots = (() => {
        const slots: string[] = []
        let current = new Date(2000, 0, 1, 4, 0)
        const midnight = new Date(2000, 0, 2, 0, 0)
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
                    <p className="text-muted-foreground mt-1">
                        Manage leaves and work availability
                    </p>
                </div>
                {user?.role === 'admin' && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Set Your Availability
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-7xl h-[90vh] overflow-y-auto">
                            <DialogTitle>Set My Availability</DialogTitle>
                            <LeaveManagement timeSlots={timeSlots} />
                            <AvailabilityTable timeSlots={timeSlots} />
                        </DialogContent>
                    </Dialog>
                )}
            </div>
            {user && (user.role === 'operationsstaff' || user.role === 'itteam') && (
                <>
                    <LeaveManagement timeSlots={timeSlots} />
                    <AvailabilityTable timeSlots={timeSlots} />
                </>
            )}
            {user?.role === 'admin' && (
                <>
                    <AdminLeave />
                    <AvailibilitySlot />
                </>
            )}
        </div>
    )
}

export default Availability