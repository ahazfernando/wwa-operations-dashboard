// LeaveManagement.tsx
import React, { useState, useEffect } from 'react'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    Badge,
} from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { onAuthStateChanged, User } from 'firebase/auth'
import { collection, addDoc, query, where, onSnapshot, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase' // Adjust path to your Firebase config file
import { useToast } from '@/components/ui/use-toast'
import { format, addDays, isBefore, startOfDay } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type LeaveRequest = {
    id: string
    fromDate: string
    toDate: string
    status: 'pending' | 'approved' | 'rejected'
    description?: string
    type?: 'day' | 'slot'
    startSlot?: number
    endSlot?: number
    days?: number
}

interface LeaveManagementProps {
    timeSlots: string[]
}

const LeaveManagement: React.FC<LeaveManagementProps> = ({ timeSlots }) => {
    const { toast } = useToast()

    // Auth state
    const [user, setUser] = useState<User | null>(null)

    // Leave Management states
    const [leaveType, setLeaveType] = useState<'day' | 'slot'>('day')
    const [leaveDate, setLeaveDate] = useState<Date>()
    const [applyDays, setApplyDays] = useState('')
    const [description, setDescription] = useState('')
    const [startSlot, setStartSlot] = useState<number>(0)
    const [endSlot, setEndSlot] = useState<number>(1)
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])

    useEffect(() => {
        if (!auth) return
        const unsub = onAuthStateChanged(auth, setUser)
        return unsub
    }, [])

    // Fetch leave requests
    useEffect(() => {
        if (!db || !user) {
            setLeaveRequests([])
            return
        }
        const q = query(collection(db, 'leaveRequests'), where('uid', '==', user.uid))
        const unsub = onSnapshot(q, (snap) => {
            const now = new Date()
            const reqs = snap.docs
                .filter((d) => {
                    const toD = d.data().toDate.toDate()
                    return toD > now
                })
                .map((d) => {
                    const data = d.data()
                    const from = data.fromDate.toDate()
                    const to = data.toDate.toDate()
                    const diffTime = to.getTime() - from.getTime()
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
                    return {
                        id: d.id,
                        fromDate: format(from, 'MMM dd'),
                        toDate: format(to, 'MMM dd'),
                        status: data.status,
                        description: data.description,
                        type: data.type,
                        startSlot: data.startSlot,
                        endSlot: data.endSlot,
                        days: data.type === 'day' ? diffDays : undefined,
                    }
                })
            setLeaveRequests(reqs)
        })
        return unsub
    }, [user])

    const canRequestLeave =
        !!user &&
        !!leaveDate &&
        (leaveType === 'day'
            ? !!applyDays && !!description && !isNaN(Number(applyDays)) && Number(applyDays) > 0
            : startSlot <= endSlot
        )

    const requestLeave = () => {
        if (!canRequestLeave || !db) return
        if (leaveType === 'day') {
            const days = Number(applyDays)
            const toDateCalc = addDays(leaveDate!, days - 1)
            addDoc(collection(db, 'leaveRequests'), {
                uid: user!.uid,
                type: 'day',
                fromDate: Timestamp.fromDate(leaveDate!),
                toDate: Timestamp.fromDate(toDateCalc),
                description,
                status: 'pending',
                appliedAt: Timestamp.fromDate(new Date()),
            })
            setLeaveDate(undefined)
            setApplyDays('')
            setDescription('')
        } else {
            addDoc(collection(db, 'leaveRequests'), {
                uid: user!.uid,
                type: 'slot',
                fromDate: Timestamp.fromDate(leaveDate!),
                toDate: Timestamp.fromDate(leaveDate!),
                startSlot: startSlot,
                endSlot: endSlot,
                status: 'pending',
                appliedAt: Timestamp.fromDate(new Date()),
            })
            setLeaveDate(undefined)
            setStartSlot(0)
            setEndSlot(1)
        }
        toast({
            title: "Leave requested successfully",
            description: "Your leave request has been submitted."
        })
    }

    const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
        switch (status) {
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 mt-3 px-6 hover:bg-yellow-100">Pending</Badge>
            case 'approved':
                return <Badge className="bg-green-100 text-green-800 border-green-200 mt-3 px-6 hover:bg-green-100">Approved</Badge>
            case 'rejected':
                return <Badge className="bg-red-100 text-red-800 border-red-200 mt-3 px-6 hover:bg-red-100">Rejected</Badge>
            default:
                return <Badge>Unknown</Badge>
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card className="w-full md:col-span-2 lg:col-span-3">
                <CardHeader>
                    <CardTitle>Apply Leaves</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div className="space-y-2">
                                <Label htmlFor="leaveType">Leave Type</Label>
                                <Select value={leaveType} onValueChange={(value) => setLeaveType(value as 'day' | 'slot')}>
                                    <SelectTrigger id="leaveType">
                                        <SelectValue placeholder="Select leave type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="day">Day Leaves</SelectItem>
                                        <SelectItem value="slot">Slot Leaves</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={requestLeave} disabled={!canRequestLeave} className="w-full md:mt-8">
                                    Request Leave
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-2">
                                <Label htmlFor="date">Apply Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={'outline'}
                                            className={cn(
                                                'w-full justify-start text-left font-normal',
                                                !leaveDate && 'text-muted-foreground'
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {leaveDate ? format(leaveDate, 'PPP') : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={leaveDate}
                                            onSelect={setLeaveDate}
                                            initialFocus
                                            disabled={(date: Date) => isBefore(date, startOfDay(new Date()))}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {leaveType === 'day' ? (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="applyDays">Apply Days</Label>
                                        <Input
                                            id="applyDays"
                                            type="number"
                                            placeholder="e.g., 5"
                                            value={applyDays}
                                            onChange={(e) => setApplyDays(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Input
                                            id="description"
                                            placeholder="Enter leave description..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="startTime">Start Time</Label>
                                        <Select value={startSlot.toString()} onValueChange={(v) => setStartSlot(Number(v))}>
                                            <SelectTrigger id="startTime">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {timeSlots.map((slot, i) => (
                                                    <SelectItem key={i} value={i.toString()}>
                                                        {slot.split(' - ')[0]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="endTime">End Time</Label>
                                        <Select value={endSlot.toString()} onValueChange={(v) => setEndSlot(Number(v))}>
                                            <SelectTrigger id="endTime">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {timeSlots.map((slot, i) => (
                                                    <SelectItem key={i} value={i.toString()}>
                                                        {slot.split(' - ')[0]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="w-full col-span-2 lg:col-span-1">
                <CardHeader>
                    <CardTitle>Leave Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                    {leaveRequests.length === 0 ? (
                        <p className="text-muted-foreground text-left py-4">No Leaves Applied</p>
                    ) : (
                        leaveRequests.map((request) => (
                            <div key={request.id} className="space-y-2 border-b pb-3 last:border-b-0 last:pb-0">
                                <p className="text-sm font-medium text-foreground">
                                    {request.type === 'slot'
                                        ? `On ${request.fromDate} from ${timeSlots[request.startSlot || 0]?.split(' - ')[0] || ''} to ${timeSlots[request.endSlot || 0]?.split(' - ')[0] || ''}`
                                        : `From ${request.fromDate} to ${request.toDate}`
                                    }
                                </p>
                                <div className="flex justify-between items-center">
                                    {getStatusBadge(request.status)}
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default LeaveManagement