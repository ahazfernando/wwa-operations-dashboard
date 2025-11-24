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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { format, startOfWeek, addDays, subWeeks, addWeeks, isBefore, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Edit3, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { onAuthStateChanged, User } from 'firebase/auth'
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, Timestamp } from 'firebase/firestore'
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

interface AvailabilityTableProps {
    timeSlots: string[]
}

const threeDCell = cn(
    'relative h-full rounded-lg overflow-hidden bg-white/30 backdrop-blur-sm border-4 border-white/40',
    'rounded-lg overflow-hidden',
    'cursor-pointer',
    'transition-transform duration-200',
    'hover:translate-y-[-1px] hover:shadow-2xl',
    'active:translate-y-0 active:shadow-inner',
    'bg-white/30 backdrop-blur-sm',
    'border-4 border-white/40 aligh-center'
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
                if (Array.isArray(parsed.selected)) {
                    setSelected(new Set(parsed.selected))
                }
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
                    if (slot.status !== 'request-remove') {
                        visible.add(`${date}-${slot.timeIndex}`)
                    }
                })
            })
            setSelected(visible)
        })

        unsubRef.current = unsubscribe
        return () => unsubscribe()
    }, [user, weekKey, draftKey])

    const isPastDate = (dateStr: string): boolean => {
        return dateStr < format(startOfDay(new Date()), 'yyyy-MM-dd')
    }

    const toggleSlot = useCallback((key: string) => {
        if (isSubmitted) return
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
        saveDraft()
    }, [isSubmitted, saveDraft])

    const toggleInEdit = (key: string) => {
        setEditSelection((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
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
                const existing = weekData.slots[date]?.find(s => s.timeIndex === tIdx)

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

    const getDisplay = (date: string, tIdx: number) => {
        if (!weekData) {
            return selected.has(`${date}-${tIdx}`)
                ? { text: 'Selected', className: 'bg-blue-100 text-blue-800' }
                : null
        }

        const slot = weekData.slots[date]?.find(s => s.timeIndex === tIdx)
        if (!slot) return null

        const map: Record<SlotStatus, { text: string; className: string }> = {
            approved: { text: 'Approved', className: 'bg-green-100 text-green-800' },
            pending: { text: 'Pending', className: 'bg-blue-100 text-blue-800' },
            'request-add': { text: 'Requesting', className: 'bg-yellow-100 text-yellow-800' },
            'request-remove': { text: 'Remove', className: 'bg-red-100 text-red-800 line-through' },
        }

        return map[slot.status]
    }

    const formatSlotLabel = (index: number) => {
        const n = index + 1
        return n < 10 ? `Slot 0${n}` : `Slot ${n}`
    }

    return (
        <>
            <Card className="shadow-xl border-0 rounded-xl max-h-[90vh] overflow-y-auto">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-5 p-10">
                    <div className="flex items-center gap-4">
                        <Sparkles className="h-8 w-8" />
                        <h1 className="text-2xl font-bold">Weekly Availability</h1>
                    </div>

                    <div className="flex gap-4">
                        {isSubmitted && (
                            <Button variant="outline" onClick={openEdit} className="border-2">
                                <Edit3 className="h-4 w-4 mr-2" /> Edit
                            </Button>
                        )}
                        <Button
                            onClick={submitAvailability}
                            disabled={isSubmitted || selected.size === 0}
                            className={cn(
                                'bg-blue-500 hover:bg-blue-600',
                                (isSubmitted || selected.size === 0) && 'opacity-60 cursor-not-allowed'
                            )}
                        >
                            {isSubmitted ? 'Submitted' : 'Submit Availability'}
                        </Button>
                    </div>
                </div>

                <CardContent className="p-0">
                    <div className="flex items-center justify-center gap-6 mb-8">
                        <Button variant="ghost" size="icon" onClick={prevWeek}>
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            Week of {format(currentWeek, 'MMMM d, yyyy')}
                        </div>
                        <Button variant="ghost" size="icon" onClick={nextWeek}>
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-36 text-center sticky left-0 z-20 bg-background border-r">
                                        Time
                                    </TableHead>
                                    {dayNames.map((day, i) => (
                                        <TableHead
                                            key={day}
                                            className="min-w-[160px] text-center border-x"
                                        >
                                            <div className="font-bold">{day}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {format(addDays(currentWeek, i), 'MM/dd')}
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {timeSlots.map((slot, tIdx) => (
                                    <TableRow key={slot}>
                                        <TableCell className="text-center font-medium sticky left-0 z-10 bg-background border-r w-36">
                                            {slot}
                                        </TableCell>
                                        {dayNames.map((_, dIdx) => {
                                            const date = format(addDays(currentWeek, dIdx), 'yyyy-MM-dd')
                                            const key = `${date}-${tIdx}`
                                            const isPast = isPastDate(date)
                                            const display = getDisplay(date, tIdx)
                                            const showSelected = !weekData && selected.has(key)

                                            const baseClasses = cn(
                                                threeDCell,
                                                'mx-3 my-2',
                                                isPast && 'opacity-40 cursor-not-allowed',
                                                !isPast && !isSubmitted && 'hover:brightness-105'
                                            )

                                            return (
                                                <TableCell
                                                    key={key}
                                                    className="w-40 h-20 p-3 align-middle"
                                                    onClick={() => !isPast && !isSubmitted && toggleSlot(key)}
                                                >
                                                    <div className={baseClasses}>
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                                                            {display && (
                                                                <div
                                                                    className={cn(
                                                                        'px-4 py-1 rounded-full text-white font-medium text-xs shadow-xl',
                                                                        display.text === 'Approved' && 'bg-green-500',
                                                                        display.text === 'Selected' && 'bg-blue-500',
                                                                        (display.text === 'Pending' || display.text === 'Requesting') && 'bg-yellow-500',
                                                                        display.text === 'Remove' && 'bg-red-500 line-through'
                                                                    )}
                                                                >
                                                                    {display.text}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-center h-full w-full">
                                                            <span className={cn(
                                                                'text-sm font-medium text-gray-800 dark:text-gray-100 select-none',
                                                                showSelected && 'text-blue-800'
                                                            )}>
                                                                {formatSlotLabel(tIdx)}
                                                            </span>
                                                        </div>

                                                        <div className={cn(
                                                            'absolute inset-0 rounded-lg pointer-events-none ring-0 transition-all'
                                                        )} />
                                                    </div>
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Availability</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-4 text-sm text-muted-foreground">
                                <p>Click any slot to add or remove from your availability.</p>
                                <div className="flex flex-wrap gap-6 font-medium">
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-green-500" /> Selected
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-yellow-500" /> Requesting Add
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-red-500" /> Requesting Remove
                                    </span>
                                </div>
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 bg-background z-10 w-36 border-r">Time</TableHead>
                                    {dayNames.map((d, i) => (
                                        <TableHead key={d} className="min-w-[160px] text-center border-x">
                                            <div>{d}</div>
                                            <div className="text-xs">{format(addDays(currentWeek, i), 'MM/dd')}</div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {timeSlots.map((slot, tIdx) => (
                                    <TableRow key={slot}>
                                        <TableCell className="text-center font-medium sticky left-0 bg-background z-10 w-36 border-r">
                                            {slot}
                                        </TableCell>
                                        {dayNames.map((_, dIdx) => {
                                            const date = format(addDays(currentWeek, dIdx), 'yyyy-MM-dd')
                                            const key = `${date}-${tIdx}`
                                            const isPast = isPastDate(date)
                                            const wasSelected = selected.has(key)
                                            const nowSelected = editSelection.has(key)

                                            let bgClass = 'bg-white/20'
                                            let badgeText: string | null = null
                                            let badgeVariant: 'default' | 'destructive' = 'default'

                                            if (isPast) {
                                                bgClass = 'opacity-40 cursor-not-allowed'
                                            } else if (!wasSelected && nowSelected) {
                                                bgClass = 'bg-yellow-100'
                                                badgeText = 'Requesting'
                                            } else if (wasSelected && !nowSelected) {
                                                bgClass = 'bg-red-100 line-through'
                                                badgeText = 'Remove'
                                                badgeVariant = 'destructive'
                                            } else if (wasSelected && nowSelected) {
                                                bgClass = 'bg-green-100'
                                                badgeText = 'Selected'
                                            }

                                            return (
                                                <TableCell
                                                    key={key}
                                                    className={cn(
                                                        'p-3 w-40 h-20 border-x',
                                                        !isPast && 'cursor-pointer',
                                                        isPast && 'cursor-not-allowed'
                                                    )}
                                                    onClick={() => !isPast && toggleInEdit(key)}
                                                >
                                                    <div className={cn(
                                                        'relative h-full rounded-lg overflow-hidden bg-white/30 backdrop-blur-sm border-4 border-white/40',
                                                        bgClass,
                                                        !isPast && 'hover:translate-y-[-3px] hover:shadow-lg'
                                                    )}>
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                                            {badgeText && (
                                                                <Badge
                                                                    className={cn(
                                                                        'px-3 py-1 text-white font-semibold shadow-lg',
                                                                        badgeText === 'Selected' && 'bg-green-500',
                                                                        badgeText === 'Requesting' && 'bg-yellow-500',
                                                                        badgeText === 'Remove' && 'bg-red-500 line-through'
                                                                    )}
                                                                >
                                                                    {badgeText}
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-center h-full w-full">
                                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
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

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={confirmEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default AvailabilityTable
