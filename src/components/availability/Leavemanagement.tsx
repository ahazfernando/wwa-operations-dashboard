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
import { Badge } from '@/components/ui/badge'
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { onAuthStateChanged, User } from 'firebase/auth'
import { collection, addDoc, query, where, onSnapshot, Timestamp, DocumentData } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useToast } from '@/components/ui/use-toast'
import { format, addDays, isBefore, startOfDay, isAfter, isSameDay } from 'date-fns'
import { CalendarIcon, Clock, CalendarDays, History } from 'lucide-react'
import { cn } from '@/lib/utils'

type LeaveRequest = {
    id: string
    fromDate: string
    toDate: string
    fullFromDate: Date
    fullToDate: Date
    status: 'pending' | 'approved' | 'rejected'
    description?: string
    type?: 'day' | 'slot'
    startSlot?: number
    endSlot?: number
    days?: number
}

interface SlotData {
    status: string
    timeIndex: number
}

interface LeaveManagementProps {
    timeSlots: string[]
}

const LeaveManagement: React.FC<LeaveManagementProps> = ({ timeSlots }) => {
    const { toast } = useToast()
    const [user, setUser] = useState<User | null>(null)
    const [leaveType, setLeaveType] = useState<'day' | 'slot'>('day')
    const [leaveDate, setLeaveDate] = useState<Date | undefined>(undefined)
    const [applyDays, setApplyDays] = useState('')
    const [description, setDescription] = useState('')
    const [startSlot, setStartSlot] = useState<number | undefined>(undefined)
    const [endSlot, setEndSlot] = useState<number | undefined>(undefined)
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
    const [dialogOpen, setDialogOpen] = useState(false)
    const [approvedAvailability, setApprovedAvailability] = useState<Record<string, number[]>>({})
    const [availableDates, setAvailableDates] = useState<Date[]>([])

    useEffect(() => {
        if (!user) {
            setApprovedAvailability({})
            setAvailableDates([])
            return
        }

        const q = query(collection(db, 'weeklyAvailability'), where('uid', '==', user.uid))

        const unsub = onSnapshot(q, (snapshot) => {
            const approved: Record<string, number[]> = {}

            snapshot.docs.forEach((doc) => {
                const data = doc.data() as DocumentData
                const slotsObj = data.slots as Record<string, SlotData[]> | undefined

                if (!slotsObj) return

                Object.entries(slotsObj).forEach(([date, slots]) => {
                    const approvedSlots = slots
                        .filter((s) => s.status === 'approved')
                        .map((s) => s.timeIndex)

                    if (approvedSlots.length > 0) {
                        approved[date] = [...new Set([...(approved[date] || []), ...approvedSlots])]
                    }
                })
            })

            setApprovedAvailability(approved)

            const dates = Object.keys(approved)
                .map((d) => new Date(d))
                .filter((d) => !isBefore(d, startOfDay(new Date())))

            setAvailableDates(dates)
        })

        return unsub
    }, [user])

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, setUser)
        return unsub
    }, [])

    useEffect(() => {
        if (!user) {
            setLeaveRequests([])
            return
        }

        const q = query(collection(db, 'leaveRequests'), where('uid', '==', user.uid))
        const unsub = onSnapshot(q, (snap) => {
            const now = new Date()
            const reqs = snap.docs
                .map((d) => {
                    const data = d.data() as DocumentData
                    const from = data.fromDate.toDate() as Date
                    const to = data.toDate.toDate() as Date
                    const diffTime = to.getTime() - from.getTime()
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

                    return {
                        id: d.id,
                        fromDate: format(from, 'MMM dd'),
                        toDate: format(to, 'MMM dd, yyyy'),
                        fullFromDate: from,
                        fullToDate: to,
                        status: data.status as 'pending' | 'approved' | 'rejected',
                        description: data.description as string | undefined,
                        type: data.type as 'day' | 'slot' | undefined,
                        startSlot: data.startSlot as number | undefined,
                        endSlot: data.endSlot as number | undefined,
                        days: data.type === 'day' ? diffDays : undefined,
                    }
                })
                .filter((req) => isAfter(req.fullToDate, now) || isSameDay(req.fullToDate, now))
                .sort((a, b) => b.fullFromDate.getTime() - a.fullFromDate.getTime())

            setLeaveRequests(reqs)
        })

        return unsub
    }, [user])

    const getApprovedSlotsForDate = (date?: Date): number[] => {
        if (!date) return []
        const dateStr = format(date, 'yyyy-MM-dd')
        return approvedAvailability[dateStr] || []
    }

    const approvedSlotIndices = getApprovedSlotsForDate(leaveDate)

    useEffect(() => {
        setStartSlot(undefined)
        setEndSlot(undefined)
    }, [leaveDate, leaveType])

    const canRequestLeave =
        !!user &&
        !!leaveDate &&
        isAfter(leaveDate, startOfDay(new Date())) &&
        (leaveType === 'day'
            ? !!applyDays && !!description && !isNaN(Number(applyDays)) && Number(applyDays) > 0
            : approvedSlotIndices.length > 0 &&
              startSlot !== undefined &&
              endSlot !== undefined &&
              startSlot <= endSlot)

    const requestLeave = async () => {
        if (!canRequestLeave || !user || !leaveDate) return

        try {
            if (leaveType === 'day') {
                const days = Number(applyDays)
                const toDate = addDays(leaveDate, days - 1)

                await addDoc(collection(db, 'leaveRequests'), {
                    uid: user.uid,
                    type: 'day',
                    fromDate: Timestamp.fromDate(leaveDate),
                    toDate: Timestamp.fromDate(toDate),
                    description,
                    status: 'pending',
                    appliedAt: Timestamp.now(),
                })

                setApplyDays('')
                setDescription('')
            } else {
                await addDoc(collection(db, 'leaveRequests'), {
                    uid: user.uid,
                    type: 'slot',
                    fromDate: Timestamp.fromDate(leaveDate),
                    toDate: Timestamp.fromDate(leaveDate),
                    startSlot,
                    endSlot,
                    status: 'pending',
                    appliedAt: Timestamp.now(),
                })

                setStartSlot(undefined)
                setEndSlot(undefined)
            }

            setLeaveDate(undefined)
            toast({
                title: 'Leave Requested',
                description: 'Your leave request has been submitted successfully.',
            })
        } catch {
            toast({
                title: 'Error',
                description: 'Failed to submit leave request.',
                variant: 'destructive',
            })
        }
    }

    const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
        const variants: Record<string, string> = {
            pending: 'bg-amber-100 text-amber-700 border-amber-200',
            approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            rejected: 'bg-rose-100 text-rose-700 border-rose-200',
        }

        return (
            <Badge className={cn('px-3 py-1 font-medium', variants[status])}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
        )
    }

    const getStartTime = (slot: string) => slot.split(' - ')[0]
    const getEndTime = (slot: string) => slot.split(' - ')[1]?.trim() || slot.split(' - ')[0]

    return (
        <div className="max-w-7xl mx-auto p-4">
            <Card className="shadow-xl border- go0 overflow-hidden">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold flex items-center gap-3">
                            <CalendarDays className="w-8 h-8" />
                            Leave Management
                        </CardTitle>

                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" size="lg" className="shadow-lg hover:scale-105 transition-transform">
                                    <History className="w-5 h-5 mr-2" />
                                    View Leave History
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh]">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl flex items-center gap-2">
                                        <Clock className="w-6 h-6" />
                                        Your Leave History
                                    </DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="mt-4 max-h-[60vh] pr-4">
                                    {leaveRequests.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                            <p>No leave requests found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {leaveRequests.map((req) => (
                                                <div key={req.id} className="bg-muted/50 rounded-lg p-4 border">
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <p className="font-semibold text-foreground">
                                                                {req.type === 'day' ? (
                                                                    <span className="flex items-center gap-2">
                                                                        <CalendarDays className="w-4 h-4" />
                                                                        {req.fromDate} - {req.toDate}
                                                                        {req.days && (
                                                                            <span className="text-sm text-muted-foreground">
                                                                                ({req.days} {req.days === 1 ? 'day' : 'days'})
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center gap-2">
                                                                        <Clock className="w-4 h-4" />
                                                                        {req.fromDate} • {timeSlots[req.startSlot!]?.split(' - ')[0]} - {getEndTime(timeSlots[req.endSlot!])}
                                                                    </span>
                                                                )}
                                                            </p>
                                                            {req.description && (
                                                                <p className="text-sm text-muted-foreground italic">"{req.description}"</p>
                                                            )}
                                                        </div>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>

                <CardContent className="pt-8 pb-10">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-2 w-64">
                                <Label htmlFor="leaveType" className="text-base font-semibold">Leave Type</Label>
                                <Select value={leaveType} onValueChange={(v) => setLeaveType(v as 'day' | 'slot')}>
                                    <SelectTrigger id="leaveType">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="day">Full Day Leave</SelectItem>
                                        <SelectItem value="slot">Time Slot Leave</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button
                                onClick={requestLeave}
                                disabled={!canRequestLeave}
                                size="lg"
                                className="shadow-lg hover:shadow-xl transition-all hover:scale-105"
                            >
                                <CalendarIcon className="w-5 h-5 mr-2" />
                                Apply for Leave
                            </Button>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div className="space-y-2">
                                <Label>Date {leaveType === 'slot' && '(Must have approved slots)'}</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn('w-full justify-start font-normal', !leaveDate && 'text-muted-foreground')}
                                        >
                                            <CalendarIcon className="mr-2 h-5 w-5" />
                                            {leaveDate ? format(leaveDate, 'PPP') : 'Pick a date'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={leaveDate}
                                            onSelect={setLeaveDate}
                                            disabled={(date) =>
                                                isBefore(date, startOfDay(new Date())) ||
                                                !availableDates.some((d) => isSameDay(d, date))
                                            }
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                {leaveType === 'slot' && leaveDate && approvedSlotIndices.length === 0 && (
                                    <p className="text-sm text-destructive">No approved slots on this date</p>
                                )}
                            </div>

                            {leaveType === 'day' ? (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="applyDays">Number of Days</Label>
                                        <Input
                                            id="apply-days"
                                            type="number"
                                            min="1"
                                            placeholder="e.g. 3"
                                            value={applyDays}
                                            onChange={(e) => setApplyDays(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Reason</Label>
                                        <Input
                                            id="description"
                                            placeholder="Brief reason for leave..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label>From Time</Label>
                                        <Select
                                            value={startSlot?.toString()}
                                            onValueChange={(v) => {
                                                const val = Number(v)
                                                setStartSlot(val)
                                                if (endSlot !== undefined && endSlot < val) {
                                                    setEndSlot(undefined)
                                                }
                                            }}
                                            disabled={approvedSlotIndices.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select start time" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {approvedSlotIndices.map((idx) => (
                                                    <SelectItem key={idx} value={idx.toString()}>
                                                        {getStartTime(timeSlots[idx])}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>To Time</Label>
                                        <Select
                                            value={endSlot?.toString()}
                                            onValueChange={(v) => setEndSlot(Number(v))}
                                            disabled={!startSlot || approvedSlotIndices.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select end time" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {approvedSlotIndices
                                                    .filter((idx) => startSlot !== undefined && idx >= startSlot)
                                                    .map((idx) => (
                                                        <SelectItem key={idx} value={idx.toString()}>
                                                            {getEndTime(timeSlots[idx])}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        {startSlot !== undefined &&
                                            approvedSlotIndices.filter(i => i >= startSlot).length === 0 && (
                                                <p className="text-xs text-destructive mt-1">
                                                    No available end time on or after selected start
                                                </p>
                                            )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default LeaveManagement