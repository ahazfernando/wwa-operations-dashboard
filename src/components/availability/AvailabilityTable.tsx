import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { format, startOfWeek, addDays, subWeeks, addWeeks, isBefore, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Edit3 } from 'lucide-react'
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

const AvailabilityTable: React.FC<AvailabilityTableProps> = ({ timeSlots }) => {
    const { toast } = useToast()
    const [user, setUser] = useState<User | null>(null)
    const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [selected, setSelected] = useState<Set<string>>(new Set()) // Visible slots in main table
    const [weekData, setWeekData] = useState<WeekData | null>(null)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [editSelection, setEditSelection] = useState<Set<string>>(new Set()) // Temp selection during edit

    const unsubRef = useRef<(() => void) | null>(null)
    const draftLoaded = useRef(false)
    const weekKey = format(currentWeek, 'yyyy-MM-dd')
    const draftKey = user ? `draft-availability-${user.uid}-${weekKey}` : null

    // Save draft
    const saveDraft = useCallback(() => {
        if (!draftKey) return
        localStorage.setItem(draftKey, JSON.stringify({ selected: Array.from(selected) }))
    }, [draftKey, selected])

    // Load draft
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

    // Auth listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, setUser)
        return () => unsubscribe()
    }, [])

    // Firestore real-time listener
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

            // Rebuild visible slots
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
                } else if (wasSelected && nowSelected) {
                    if (existing) {
                        daySlots.push(existing)
                    }
                }
            })

            if (daySlots.length > 0) newSlots[date] = daySlots
        })

        try {
            await updateDoc(doc(db, 'weeklyAvailability', weekData.id), {
                slots: newSlots,
                submittedAt: Timestamp.now(),
            })

            // Fixed: No more ESLint error — clean & safe
            setSelected(new Set(editSelection))

            setEditOpen(false)
            toast({ title: 'Changes requested successfully!' })
        } catch {
            toast({ title: 'Failed to save changes', variant: 'destructive' })
        }
    }

    // Badge display — no icons, only text
    const getDisplay = (date: string, tIdx: number) => {
        if (!weekData) {
            return selected.has(`${date}-${tIdx}`)
                ? { text: 'Draft', className: 'bg-blue-100 text-blue-800 border-blue-300' }
                : null
        }

        const slot = weekData.slots[date]?.find(s => s.timeIndex === tIdx)
        if (!slot) return null

        const map: Record<SlotStatus, { text: string; className: string }> = {
            approved: { text: 'Approved', className: 'bg-green-100 hover:bg-green-100 text-green-800 border-green-300' },
            pending: { text: 'Pending', className: 'bg-blue-100 hover:bg-blue-100 text-blue-800 border-blue-300' },
            'request-add': { text: 'Requesting', className: 'bg-yellow-100 hover:bg-yellow-100 text-yellow-800 border-yellow-300' },
            'request-remove': { text: 'Remove', className: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-300 line-through' },
        }

        return map[slot.status]
    }

    return (
        <>
            <Card className="shadow-xl border-0 rounded-xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-end gap-3 p-5 border-b">
                    {isSubmitted && (
                        <Button variant="outline" onClick={openEdit}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Availability
                        </Button>
                    )}
                    <Button onClick={submitAvailability} disabled={isSubmitted || selected.size === 0}>
                        {isSubmitted ? 'Submitted' : 'Submit Availability'}
                    </Button>
                </div>

                <CardContent className="p-0">
                    <div className="flex justify-between items-center px-6 py-4 border-b">
                        <Button variant="outline" size="sm" onClick={prevWeek}>
                            <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                        </Button>
                        <div className="font-bold text-lg">Week of {format(currentWeek, 'MMM dd, yyyy')}</div>
                        <Button variant="outline" size="sm" onClick={nextWeek}>
                            Next <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>

                    <div className="overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-30 text-center sticky left-0 z-10 bg-background">Time</TableHead>
                                    {dayNames.map((day, i) => (
                                        <TableHead key={day} className="text-center">
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
                                        <TableHead className="text-center font-medium sticky left-0 z-10 bg-background">
                                            {slot}
                                        </TableHead>
                                        {dayNames.map((_, dIdx) => {
                                            const date = format(addDays(currentWeek, dIdx), 'yyyy-MM-dd')
                                            const key = `${date}-${tIdx}`
                                            const isPast = isPastDate(date)
                                            const display = getDisplay(date, tIdx)

                                            return (
                                                <TableCell
                                                    key={key}
                                                    className={cn(
                                                        'h-12 border text-center cursor-pointer transition-all',
                                                        isPast && 'opacity-40 cursor-not-allowed',
                                                        display?.className || (selected.has(key) && !weekData ? 'bg-blue-50 border-blue-300' : '')
                                                    )}
                                                    onClick={() => !isPast && !isSubmitted && toggleSlot(key)}
                                                >
                                                    {display && (
                                                        <Badge variant="secondary" className={cn('text-xs', display.className)}>
                                                            {display.text}
                                                        </Badge>
                                                    )}
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

            {/* Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Availability</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-4 text-sm text-muted-foreground">
                                <p>Click any slot to add or remove from your availability.</p>
                                <div className="flex flex-wrap gap-6 font-medium">
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-green-500" /> Already Selected
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-yellow-500" /> Requesting
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-red-500" /> Remove
                                    </span>
                                </div>
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto mt-4">
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
                                        <TableHead className="text-center font-medium sticky left-0 bg-background z-10">
                                            {slot}
                                        </TableHead>
                                        {dayNames.map((_, dIdx) => {
                                            const date = format(addDays(currentWeek, dIdx), 'yyyy-MM-dd')
                                            const key = `${date}-${tIdx}`
                                            const isPast = isPastDate(date)
                                            const wasSelected = selected.has(key)
                                            const nowSelected = editSelection.has(key)

                                            let cellClass = 'h-12 border text-center relative transition-all'
                                            let badgeText: string | null = null
                                            let badgeColor = ''

                                            if (isPast) {
                                                cellClass += ' opacity-40 cursor-not-allowed'
                                            } else if (!wasSelected && nowSelected) {
                                                cellClass += ' bg-yellow-100 border-2 border-yellow-600 cursor-pointer'
                                                badgeText = 'Requesting'
                                                badgeColor = 'bg-yellow-600 text-white'
                                            } else if (wasSelected && !nowSelected) {
                                                cellClass += ' bg-red-100 border-2 border-red-600 line-through cursor-pointer'
                                                badgeText = 'Remove'
                                                badgeColor = 'bg-red-600 text-white'
                                            } else if (wasSelected && nowSelected) {
                                                cellClass += ' bg-green-100 border-2 border-green-600 cursor-pointer'
                                                badgeText = 'Selected'
                                                badgeColor = 'bg-green-600 text-white'
                                            } else {
                                                cellClass += ' opacity-30 cursor-default'
                                            }

                                            return (
                                                <TableCell
                                                    key={key}
                                                    className={cn(cellClass)}
                                                    onClick={() => !isPast && toggleInEdit(key)}
                                                >
                                                    {badgeText && (
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                                            <Badge className={cn('text-xs', badgeColor)}>
                                                                {badgeText}
                                                            </Badge>
                                                        </div>
                                                    )}
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
                        <Button onClick={confirmEdit}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default AvailabilityTable