import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
    format,
    startOfWeek,
    addDays,
    subWeeks,
    addWeeks,
    isBefore,
    startOfDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Edit3, Sparkles } from 'lucide-react'
import { onAuthStateChanged, User } from 'firebase/auth'
import {
    collection,
    doc,
    updateDoc,
    addDoc,
    query,
    where,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useToast } from '@/components/ui/use-toast'

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

type SlotStatus = 'approved' | 'pending' | 'request-add' | 'request-remove'

interface AvailabilitySlot {
    timeIndex: number
    status: SlotStatus
}

interface WeekData {
    id: string
    slots: Record<string, AvailabilitySlot[]>
    submittedAt: Timestamp
    weekStart: string
}

interface LeaveRequest {
    id: string
    type: 'day' | 'slot'
    fromDate: Date
    toDate: Date
    status: 'pending' | 'approved' | 'rejected'
    slotIndex?: number
}

interface AvailabilityTableProps {
    timeSlots: string[]
}

const threeDCell = cn(
    'relative h-full rounded-lg overflow-hidden bg-white/30 backdrop-blur-sm border-4 border-white/40',
    'cursor-pointer transition-transform duration-200',
    'hover:translate-y-[-1px] hover:shadow-2xl',
    'active:translate-y-0 active:shadow-inner'
)

const AvailabilityTable: React.FC<AvailabilityTableProps> = ({ timeSlots }) => {
    const { toast } = useToast()
    const [user, setUser] = useState<User | null>(null)
    const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [weekData, setWeekData] = useState<WeekData | null>(null)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [editSelection, setEditSelection] = useState<Set<string>>(new Set())
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])

    const unsubRef = useRef<(() => void) | null>(null)
    const draftLoaded = useRef(false)
    const weekKey = format(currentWeek, 'yyyy-MM-dd')
    const draftKey = user ? `draft-availability-${user.uid}-${weekKey}` : null

    const saveDraft = useCallback(() => {
        if (!draftKey) return
        localStorage.setItem(draftKey, JSON.stringify({ selected: Array.from(selected) }))
    }, [draftKey, selected])

    useEffect(() => {
        if (!user || !draftKey || draftLoaded.current) return
        const saved = localStorage.getItem(draftKey)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed.selected)) setSelected(new Set(parsed.selected))
            } catch {
                localStorage.removeItem(draftKey)
            }
        }
        draftLoaded.current = true
    }, [user, draftKey])

    useEffect(() => {
        draftLoaded.current = false
    }, [weekKey, user])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, setUser)
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        if (!user) {
            setWeekData(null)
            setIsSubmitted(false)
            setSelected(new Set())
            setLeaveRequests([])
            return
        }
        if (unsubRef.current) unsubRef.current()
        const q = query(
            collection(db, 'weeklyAvailability'),
            where('uid', '==', user.uid),
            where('weekStart', '==', weekKey)
        )
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setWeekData(null)
                setIsSubmitted(false)
                return
            }
            const docSnap = snapshot.docs[0]
            const data = docSnap.data() as Omit<WeekData, 'id'>
            const newWeekData: WeekData = {
                id: docSnap.id,
                slots: data.slots || {},
                submittedAt: data.submittedAt,
                weekStart: data.weekStart,
            }
            setWeekData(newWeekData)
            setIsSubmitted(true)
            if (draftKey) localStorage.removeItem(draftKey)
            const visible = new Set<string>()
            Object.entries(data.slots || {}).forEach(([date, daySlots]) => {
                daySlots.forEach((slot) => {
                    if (slot.status !== 'request-remove') visible.add(`${date}-${slot.timeIndex}`)
                })
            })
            setSelected(visible)
        })
        unsubRef.current = unsubscribe
        return () => unsubscribe()
    }, [user, weekKey, draftKey])

    useEffect(() => {
        if (!user) {
            setLeaveRequests([])
            return
        }
        const q = query(
            collection(db, 'leaveRequests'),
            where('uid', '==', user.uid),
            where('status', '==', 'approved')
        )
        const unsub = onSnapshot(q, (snap) => {
            const leaves: LeaveRequest[] = snap.docs.map((d) => {
                const data = d.data()
                return {
                    id: d.id,
                    type: data.type,
                    fromDate: data.fromDate.toDate(),
                    toDate: data.toDate.toDate(),
                    status: data.status,
                    slotIndex: data.slotIndex,
                }
            })
            setLeaveRequests(leaves)
        })
        return unsub
    }, [user])

    const isPastDate = (dateStr: string): boolean => dateStr < format(startOfDay(new Date()), 'yyyy-MM-dd')

    const toggleSlot = useCallback((key: string) => {
        if (isSubmitted) return
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(key)) {
                next.delete(key)
            } else {
                next.add(key)
            }
            return next
        })
        saveDraft()
    }, [isSubmitted, saveDraft])

    const toggleInEdit = (key: string) => {
        setEditSelection((prev) => {
            const next = new Set(prev)
            if (next.has(key)) {
                next.delete(key)
            } else {
                next.add(key)
            }
            return next
        })
    }

    const openEdit = () => {
        setEditSelection(new Set(selected))
        setEditOpen(true)
    }

    const prevWeek = () => {
        const prev = subWeeks(currentWeek, 1)
        if (isBefore(prev, startOfWeek(new Date(), { weekStartsOn: 1 }))) {
            toast({ title: 'Cannot view past weeks', variant: 'destructive' })
            return
        }
        setCurrentWeek(prev)
    }

    const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1))

    const submitAvailability = async () => {
        if (!user || selected.size === 0) return
        const slotsMap: Record<string, AvailabilitySlot[]> = {}
        dayNames.forEach((_, dIdx) => {
            const date = format(addDays(currentWeek, dIdx), 'yyyy-MM-dd')
            const daySlots: AvailabilitySlot[] = []
            timeSlots.forEach((_, tIdx) => {
                if (selected.has(`${date}-${tIdx}`)) {
                    daySlots.push({
                        timeIndex: tIdx,
                        status: weekData ? 'request-add' : 'pending',
                    })
                }
            })
            if (daySlots.length > 0) slotsMap[date] = daySlots
        })
        try {
            if (weekData) {
                await updateDoc(doc(db, 'weeklyAvailability', weekData.id), {
                    slots: slotsMap,
                    submittedAt: Timestamp.now(),
                })
            } else {
                await addDoc(collection(db, 'weeklyAvailability'), {
                    uid: user.uid,
                    weekStart: weekKey,
                    slots: slotsMap,
                    submittedAt: Timestamp.now(),
                })
            }
            if (draftKey) localStorage.removeItem(draftKey)
            toast({ title: 'Availability submitted!' })
        } catch {
            toast({ title: 'Failed to submit', variant: 'destructive' })
        }
    }

    const confirmEdit = async () => {
        if (!weekData || !user) return
        const newSlots: Record<string, AvailabilitySlot[]> = {}
        dayNames.forEach((_, dIdx) => {
            const date = format(addDays(currentWeek, dIdx), 'yyyy-MM-dd')
            const daySlots: AvailabilitySlot[] = []
            timeSlots.forEach((_, tIdx) => {
                const key = `${date}-${tIdx}`
                const wasSelected = selected.has(key)
                const nowSelected = editSelection.has(key)
                const existing = weekData.slots[date]?.find((s) => s.timeIndex === tIdx)
                if (!wasSelected && nowSelected) {
                    daySlots.push({ timeIndex: tIdx, status: 'request-add' })
                } else if (wasSelected && !nowSelected) {
                    if (existing?.status === 'approved' || existing?.status === 'pending') {
                        daySlots.push({ timeIndex: tIdx, status: 'request-remove' })
                    }
                } else if (wasSelected && nowSelected && existing) {
                    daySlots.push(existing)
                }
            })
            if (daySlots.length > 0) newSlots[date] = daySlots
        })
        try {
            await updateDoc(doc(db, 'weeklyAvailability', weekData.id), {
                slots: newSlots,
                submittedAt: Timestamp.now(),
            })
            setSelected(new Set(editSelection))
            setEditOpen(false)
            toast({ title: 'Changes requested successfully!' })
        } catch {
            toast({ title: 'Failed to save changes', variant: 'destructive' })
        }
    }

    const getLeaveStatusForSlot = (date: string, timeIndex: number) => {
        const dateStr = date
        const fullDayLeave = leaveRequests.find(r =>
            r.type === 'day' &&
            r.status === 'approved' &&
            format(r.fromDate, 'yyyy-MM-dd') <= dateStr &&
            format(r.toDate, 'yyyy-MM-dd') >= dateStr
        )

        if (fullDayLeave && weekData?.slots[date]?.some(s => s.timeIndex === timeIndex && s.status === 'approved')) {
            return { text: 'On Leave', className: 'bg-purple-600 text-white' }
        }

        const slotLeave = leaveRequests.find(r =>
            r.type === 'slot' &&
            r.status === 'approved' &&
            format(r.fromDate, 'yyyy-MM-dd') === dateStr &&
            r.slotIndex === timeIndex
        )

        if (slotLeave) {
            return { text: 'On Leave', className: 'bg-purple-600 text-white' }
        }

        return null
    }

    const getDisplay = (date: string, tIdx: number) => {
        const leaveStatus = getLeaveStatusForSlot(date, tIdx)
        if (leaveStatus) return leaveStatus

        if (!weekData) {
            return selected.has(`${date}-${tIdx}`)
                ? { text: 'Selected', className: 'bg-blue-500 text-white' }
                : null
        }

        const slot = weekData.slots[date]?.find(s => s.timeIndex === tIdx)
        if (!slot) return null

        const map: Record<SlotStatus, { text: string; className: string }> = {
            approved: { text: 'Approved', className: 'bg-green-500 text-white' },
            pending: { text: 'Pending', className: 'bg-yellow-500 text-white' },
            'request-add': { text: 'Requesting', className: 'bg-orange-500 text-white' },
            'request-remove': { text: 'Remove', className: 'bg-red-500 text-white line-through' },
        }

        return map[slot.status]
    }

    const formatSlotLabel = (index: number) => {
        const n = index + 1
        return n < 10 ? `Slot 0${n}` : `Slot ${n}`
    }

    return (
        <>
            <Card className="shadow-2xl border-0 rounded-2xl h-[93vh]">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 p-8 pb-4">
                    <div className="flex items-center gap-4">
                        <Sparkles className="h-8 w-8 text-white" />
                        <h1 className="text-2xl font-bold">Weekly Availability</h1>
                    </div>
                    <div className="flex gap-4">
                        {isSubmitted && (
                            <Button variant="outline" onClick={openEdit} size="lg">
                                <Edit3 className="h-5 w-5 mr-2" /> Edit
                            </Button>
                        )}
                        <Button
                            onClick={submitAvailability}
                            disabled={isSubmitted || selected.size === 0}
                            size="lg"
                            className={cn('font-semibold', isSubmitted && 'opacity-70')}
                        >
                            {isSubmitted ? 'Submitted' : 'Submit Availability'}
                        </Button>
                    </div>
                </div>

                <CardContent className="p-6 pt-5">
                    <div className="flex items-center justify-center gap-8 mb-8">
                        <Button variant="ghost" size="icon" onClick={prevWeek}>
                            <ChevronLeft className="h-7 w-7" />
                        </Button>
                        <h2 className="text-2xl font-bold">
                            Week of {format(currentWeek, 'MMMM d, yyyy')}
                        </h2>
                        <Button variant="ghost" size="icon" onClick={nextWeek}>
                            <ChevronRight className="h-7 w-7" />
                        </Button>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden">
                            <Table className="relative">
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="sticky left-0 top-0 z-30 bg-muted/50 text-center w-40">
                                            Time
                                        </TableHead>
                                        {dayNames.map((day, i) => (
                                            <TableHead
                                                key={day}
                                                className="sticky top-0 z-20 bg-muted/50 text-center min-w-[160px]"
                                            >
                                                <div className="font-bold">{day}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {format(addDays(currentWeek, i), 'MMM dd')}
                                                </div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {timeSlots.map((slot, tIdx) => (
                                        <TableRow key={slot} className="hover:bg-muted/30">
                                            <TableCell className="sticky left-0 z-10 bg-background border-r font-medium text-center whitespace-nowrap">
                                                {slot}
                                            </TableCell>
                                            {dayNames.map((_, dIdx) => {
                                                const date = format(addDays(currentWeek, dIdx), 'yyyy-MM-dd')
                                                const key = `${date}-${tIdx}`
                                                const isPast = isPastDate(date)
                                                const display = getDisplay(date, tIdx)
                                                const showSelected = !weekData && selected.has(key)

                                                return (
                                                    <TableCell
                                                        key={key}
                                                        className="p-4 h-20 w-40"
                                                        onClick={() => !isPast && !isSubmitted && toggleSlot(key)}
                                                    >
                                                        <div className={cn(
                                                            threeDCell,
                                                            'mx-2 my-3',
                                                            isPast && 'opacity-10 cursor-not-allowed',
                                                            !isPast && !isSubmitted && 'hover:brightness-110'
                                                        )}>
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                                                                {display && (
                                                                    <Badge className={cn(
                                                                        'px-4 py-1 font-bold text-xs shadow-2xl',
                                                                        display.className
                                                                    )}>
                                                                        {display.text}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-center h-full">
                                                                <span className={cn(
                                                                    'text-sm font-semibold',
                                                                    showSelected && 'text-blue-700'
                                                                )}>
                                                                    {formatSlotLabel(tIdx)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">Edit Availability</DialogTitle>
                        <p className="text-sm text-muted-foreground mt-2">
                            Click slots to add or remove from your availability.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded bg-green-500" />
                                <span className="text-sm">Available</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded bg-yellow-500" />
                                <span className="text-sm">Requesting Add</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded bg-red-500" />
                                <span className="text-sm">Requesting Remove</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded bg-purple-600" />
                                <span className="text-sm">On Leave</span>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto mt-6 border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 bg-background z-10">Time</TableHead>
                                    {dayNames.map((d, i) => (
                                        <TableHead key={d} className="text-center">
                                            <div>{d}</div>
                                            <div className="text-xs">{format(addDays(currentWeek, i), 'MM/dd')}</div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {timeSlots.map((slot, tIdx) => (
                                    <TableRow key={slot}>
                                        <TableCell className="font-medium text-center w-40 sticky left-0 bg-background z-10 border-r">
                                            {slot}
                                        </TableCell>
                                        {dayNames.map((_, dIdx) => {
                                            const date = format(addDays(currentWeek, dIdx), 'yyyy-MM-dd')
                                            const key = `${date}-${tIdx}`
                                            const isPast = isPastDate(date)
                                            const wasSelected = selected.has(key)
                                            const nowSelected = editSelection.has(key)
                                            const leaveStatus = getLeaveStatusForSlot(date, tIdx)

                                            let bgClass = 'bg-white/30'
                                            let badgeText: string | null = null
                                            let badgeColor = ''

                                            if (leaveStatus) {
                                                bgClass = 'bg-purple-200'
                                                badgeText = 'On Leave'
                                                badgeColor = 'bg-purple-600 text-white'
                                            } else if (isPast) {
                                                bgClass = 'opacity-40'
                                            } else if (!wasSelected && nowSelected) {
                                                bgClass = 'bg-yellow-200'
                                                badgeText = 'Add'
                                                badgeColor = 'bg-orange-500 text-white'
                                            } else if (wasSelected && !nowSelected) {
                                                bgClass = 'bg-red-200 line-through'
                                                badgeText = 'Remove'
                                                badgeColor = 'bg-red-500 text-white'
                                            } else if (wasSelected && nowSelected) {
                                                bgClass = 'bg-green-200'
                                                badgeText = 'Keep'
                                                badgeColor = 'bg-green-500 text-white'
                                            }

                                            return (
                                                <TableCell
                                                    key={key}
                                                    className="p-3 h-20 w-40"
                                                    onClick={() => !isPast && !leaveStatus && toggleInEdit(key)}
                                                >
                                                    <div className={cn(
                                                        'relative h-20 rounded-lg border-4 border-white/40 overflow-hidden',
                                                        bgClass,
                                                        isPast && 'opacity-10 cursor-not-allowed',
                                                        !isPast && !leaveStatus && 'cursor-pointer hover:shadow-lg'
                                                    )}>
                                                        {badgeText && (
                                                            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                                                <Badge className={cn('px-3 py-1 font-bold', badgeColor)}>
                                                                    {badgeText}
                                                                </Badge>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-center h-full">
                                                            <span className="text-sm font-medium">
                                                                {formatSlotLabel(tIdx)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button onClick={confirmEdit} size="lg">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default AvailabilityTable