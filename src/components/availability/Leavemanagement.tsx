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
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    Timestamp,
    DocumentData,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useToast } from '@/components/ui/use-toast'
import {
    format,
    addDays,
    isBefore,
    startOfDay,
    isAfter,
    isSameDay,
    isSaturday,
    isSunday,
    eachDayOfInterval,
} from 'date-fns'
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
    type: 'day' | 'slot'
    slotIndex?: number
    days?: number
}

interface LeaveManagementProps {
    timeSlots: string[]
}

const formatSlotLabel = (index: number): string => {
    const n = index + 1
    return `Slot ${n.toString().padStart(2, '0')}`
}

const formatTimeDisplay = (raw: string): string => {
    return raw.replace('.00', ':00').replace('-', ' - ')
}

const countWeekdays = (start: Date, days: number): Date => {
    let current = new Date(start)
    let count = 0
    while (count < days) {
        if (!isSaturday(current) && !isSunday(current)) count++
        if (count < days) current = addDays(current, 1)
    }
    return current
}

const LeaveManagement: React.FC<LeaveManagementProps> = ({ timeSlots }) => {
    const { toast } = useToast()
    const [user, setUser] = useState<User | null>(null)
    const [leaveType, setLeaveType] = useState<'day' | 'slot'>('day')
    const [leaveDate, setLeaveDate] = useState<Date | undefined>(undefined)
    const [applyDays, setApplyDays] = useState('')
    const [description, setDescription] = useState('')
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | undefined>(undefined)
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
    const [dialogOpen, setDialogOpen] = useState(false)
    const [approvedAvailability, setApprovedAvailability] = useState<Record<string, number[]>>({})
    const [availableDates, setAvailableDates] = useState<Date[]>([])

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, setUser)
        return unsub
    }, [])

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
                const data = doc.data()
                const slotsObj = data.slots as Record<string, { status: string; timeIndex: number }[]> | undefined
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
                    let days = 0
                    if (data.type === 'day') {
                        const dates = eachDayOfInterval({ start: from, end: to })
                        days = dates.filter((d) => !isSaturday(d) && !isSunday(d)).length
                    }
                    return {
                        id: d.id,
                        fromDate: format(from, 'MMM dd'),
                        toDate: format(to, 'MMM dd, yyyy'),
                        fullFromDate: from,
                        fullToDate: to,
                        status: data.status as 'pending' | 'approved' | 'rejected',
                        description: data.description as string | undefined,
                        type: data.type as 'day' | 'slot',
                        slotIndex: data.slotIndex as number | undefined,
                        days: data.type === 'day' ? days : undefined,
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

    const canRequestLeave =
        !!user &&
        !!leaveDate &&
        isAfter(leaveDate, startOfDay(new Date())) &&
        (leaveType === 'day'
            ? !!applyDays && !!description && !isNaN(Number(applyDays)) && Number(applyDays) > 0
            : selectedSlotIndex !== undefined && !!description && approvedSlotIndices.includes(selectedSlotIndex))

    const requestLeave = async () => {
        if (!canRequestLeave || !user || !leaveDate) return
        try {
            if (leaveType === 'day') {
                const days = Number(applyDays)
                const toDate = countWeekdays(leaveDate, days)
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
            } else {
                await addDoc(collection(db, 'leaveRequests'), {
                    uid: user.uid,
                    type: 'slot',
                    fromDate: Timestamp.fromDate(leaveDate),
                    toDate: Timestamp.fromDate(leaveDate),
                    slotIndex: selectedSlotIndex,
                    description,
                    status: 'pending',
                    appliedAt: Timestamp.now(),
                })
                setSelectedSlotIndex(undefined)
            }
            setLeaveDate(undefined)
            setDescription('')
            toast({ title: 'Leave Requested', description: 'Your leave request has been submitted.' })
        } catch {
            toast({ title: 'Error', description: 'Failed to submit leave request.', variant: 'destructive' })
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            pending: 'bg-amber-100 hover:bg-amber-100 text-amber-700 border-amber-200',
            approved: 'bg-emerald-100 hover:bg-emerald-100 text-emerald-700 border-emerald-200',
            rejected: 'bg-rose-100 hover:bg-rose-100 text-rose-700 border-rose-200',
        }
        return <Badge className={cn('px-3 py-1 font-medium', variants[status])}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
    }

    return (
        <div className="max-w-7xl mx-auto">
            <Card className="shadow-2xl border-0 overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold flex items-center gap-3">
                        <CalendarDays className="w-8 h-8" />
                        Leave Management
                    </CardTitle>
                </CardHeader>

                <CardContent className="pt-8">
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="w-96">
                                <Label className="text-lg font-semibold">Leave Type</Label>
                                <Select value={leaveType} onValueChange={(v) => setLeaveType(v as 'day' | 'slot')}>
                                    <SelectTrigger className="mt-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="day">Full Day Leave (Mon–Fri)</SelectItem>
                                        <SelectItem value="slot">Time Slot Leave</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between gap-6">
                                <Button onClick={requestLeave} disabled={!canRequestLeave} size="lg" className="shadow-lg hover:shadow-xl transition-all">
                                    <CalendarIcon className="w-5 h-5 mr-2" />
                                    Apply for Leave
                                </Button>
                                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="secondary" size="lg">
                                            <History className="w-5 h-5 mr-2" />
                                            Leave History
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-3xl max-h-[80vh]">
                                        <DialogHeader>
                                            <DialogTitle className="text-2xl">Your Leave History</DialogTitle>
                                        </DialogHeader>
                                        <ScrollArea className="mt-4 max-h-[60vh] pr-4">
                                            {leaveRequests.length === 0 ? (
                                                <p className="text-center py-10 text-muted-foreground">No leave requests yet.</p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {leaveRequests.map((req) => (
                                                        <div key={req.id} className="bg-muted/50 rounded-lg p-4 border">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    {req.type === 'day' ? (
                                                                        <p className="font-semibold">
                                                                            <CalendarDays className="inline w-4 h-4 mr-2" />
                                                                            {req.fromDate} – {req.toDate}
                                                                            {req.days && ` (${req.days} working day${req.days > 1 ? 's' : ''})`}
                                                                        </p>
                                                                    ) : (
                                                                        <p className="font-semibold">
                                                                            <Clock className="inline w-4 h-4 mr-2" />
                                                                            {req.fromDate} • {timeSlots[req.slotIndex!]}
                                                                        </p>
                                                                    )}
                                                                    {req.description && (
                                                                        <p className="text-sm text-muted-foreground mt-1 italic">"{req.description}"</p>
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
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                            <div className="space-y-3">
                                <Label className="text-base">
                                    Date {leaveType === 'slot' && '(Must have approved availability)'}
                                </Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn('w-full justify-start', !leaveDate && 'text-muted-foreground')}>
                                            <CalendarIcon className="mr-2 h-5 w-5" />
                                            {leaveDate ? format(leaveDate, 'PPP') : 'Pick a date'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={leaveDate}
                                            onSelect={setLeaveDate}
                                            disabled={(date) =>
                                                isBefore(date, startOfDay(new Date())) ||
                                                !availableDates.some((d) => isSameDay(d, date))
                                            }
                                        />
                                    </PopoverContent>
                                </Popover>
                                {leaveType === 'slot' && leaveDate && approvedSlotIndices.length === 0 && (
                                    <p className="text-sm text-destructive">No approved slots on this date</p>
                                )}
                            </div>

                            {leaveType === 'day' ? (
                                <>
                                    <div className="space-y-3">
                                        <Label>Number of Working Days (Monday – Friday)</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            placeholder="e.g. 5"
                                            value={applyDays}
                                            onChange={(e) => setApplyDays(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label>Reason</Label>
                                        <Input
                                            placeholder="Brief reason..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        <Label>Select Time Slot</Label>
                                        <Select
                                            value={selectedSlotIndex?.toString()}
                                            onValueChange={(v) => setSelectedSlotIndex(Number(v))}
                                            disabled={approvedSlotIndices.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Choose a time slot User" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {approvedSlotIndices.map((idx) => (
                                                    <SelectItem key={idx} value={idx.toString()}>
                                                        <span className="font-medium">
                                                            {formatSlotLabel(idx)} ({formatTimeDisplay(timeSlots[idx])})
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-3">
                                        <Label>Reason</Label>
                                        <Input
                                            placeholder="Reason for slot leave..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
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