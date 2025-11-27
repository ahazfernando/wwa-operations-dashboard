'use client'

import React, { useState, useEffect } from 'react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Search, CalendarIcon, Trash2, ArrowBigRight } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
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
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
    format,
    startOfDay,
    endOfDay,
    isSameDay,
    addDays,
    isToday,
    isYesterday,
    isBefore,
    isAfter,
    differenceInDays,
} from 'date-fns'
import { cn } from '@/lib/utils'
import {
    collection,
    onSnapshot,
    query,
    updateDoc,
    doc,
    getDoc,
    Timestamp,
    DocumentData,
    deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/components/ui/use-toast'

type LeaveStatus = 'pending' | 'approved' | 'rejected'
type LeaveMode = 'AdHoc' | 'Plan'

interface UserProfile {
    firstName?: string
    lastName?: string
    employeeId?: string
    email: string
}

interface LeaveRequest {
    id: string
    uid: string
    user?: UserProfile
    type: 'day' | 'slot'
    fromDate: Timestamp
    toDate: Timestamp
    slotIndex?: number
    description?: string
    status: LeaveStatus
    appliedAt: Timestamp
    mode?: LeaveMode
}

// Generate time slots: 4:00 AM → 11:00 PM (20 slots, 1-hour each)
const timeSlots = (() => {
    const slots: string[] = []
    let current = new Date(2000, 0, 1, 4, 0) // Start at 4:00 AM
    const endTime = new Date(2000, 0, 2, 0, 0) // 12:00 AM next day

    while (current < endTime) {
        const end = new Date(current.getTime() + 60 * 60 * 1000)
        const startStr = format(current, 'h:mm a').toUpperCase()
        const endStr = format(end, 'h:mm a').toUpperCase()
        slots.push(`${startStr} - ${endStr}`)
        current = end
    }
    return slots
})()

const AdminLeave: React.FC = () => {
    const { toast } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedType, setSelectedType] = useState<'all' | 'day' | 'slot'>('all')
    const [selectedStatus, setSelectedStatus] = useState<'all' | LeaveStatus>('all')
    const [selectedMode, setSelectedMode] = useState<'all' | 'AdHoc' | 'Plan'>('all')
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const handleSelectChange = <T extends string>(
        setter: React.Dispatch<React.SetStateAction<T>>
    ) => (value: string) => setter(value as T)

    const determineLeaveMode = (fromDateTimestamp: Timestamp): LeaveMode => {
        const fromDate = fromDateTimestamp.toDate()
        const today = startOfDay(new Date())
        if (isToday(fromDate) || isYesterday(fromDate)) return 'AdHoc'
        if (isAfter(fromDate, addDays(today, 1))) return 'Plan'
        return 'AdHoc'
    }

    const autoDeleteExpiredLeaves = async (requests: LeaveRequest[]) => {
        const now = new Date()
        for (const req of requests) {
            const leaveEndDate = req.toDate.toDate()
            if (isBefore(endOfDay(leaveEndDate), now)) {
                try {
                    await deleteDoc(doc(db, 'leaveRequests', req.id))
                } catch (err) {
                    console.error('Auto-delete failed:', err)
                }
            }
        }
    }

    useEffect(() => {
        const q = query(collection(db, 'leaveRequests'))
        const unsub = onSnapshot(q, async (snapshot) => {
            const requests: LeaveRequest[] = []

            for (const d of snapshot.docs) {
                const data = d.data() as DocumentData
                let userProfile: UserProfile | null = null

                try {
                    const userDoc = await getDoc(doc(db, 'users', data.uid))
                    if (userDoc.exists()) {
                        userProfile = userDoc.data() as UserProfile
                    }
                } catch (err) {
                    console.error('Error fetching user:', err)
                }

                const mode = determineLeaveMode(data.fromDate)

                requests.push({
                    id: d.id,
                    uid: data.uid,
                    user: userProfile || { email: 'Unknown User' },
                    type: data.type,
                    fromDate: data.fromDate,
                    toDate: data.toDate,
                    slotIndex: data.slotIndex,
                    description: data.description,
                    status: data.status || 'pending',
                    appliedAt: data.appliedAt || Timestamp.now(),
                    mode,
                })
            }

            await autoDeleteExpiredLeaves(requests)

            requests.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1
                if (b.status === 'pending' && a.status !== 'pending') return 1
                return b.appliedAt.toDate().getTime() - a.appliedAt.toDate().getTime()
            })

            setLeaveRequests(requests)
        })

        return () => unsub()
    }, [])

    const updateStatus = async (id: string, newStatus: LeaveStatus) => {
        try {
            await updateDoc(doc(db, 'leaveRequests', id), { status: newStatus })
            toast({ title: 'Success', description: `Leave ${newStatus}!` })
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
        }
    }

    const deleteRequest = async (id: string) => {
        if (!confirm('Permanently delete this leave request?')) return
        try {
            await deleteDoc(doc(db, 'leaveRequests', id))
            toast({ title: 'Deleted', description: 'Leave request removed.' })
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' })
        }
    }

    const filteredRequests = leaveRequests.filter((req) => {
        const profile = req.user ?? { email: '' }
        const fullName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
        const employeeId = profile.employeeId ?? ''
        const email = profile.email ?? ''
        const searchText = `${fullName} ${employeeId} ${email}`.toLowerCase()

        const matchesSearch = searchText.includes(searchQuery.toLowerCase())
        const matchesType = selectedType === 'all' || req.type === selectedType
        const matchesStatus = selectedStatus === 'all' || req.status === selectedStatus
        const matchesMode = selectedMode === 'all' || req.mode === selectedMode
        const matchesDate = !selectedDate || isSameDay(req.fromDate.toDate(), selectedDate)

        return matchesSearch && matchesType && matchesStatus && matchesMode && matchesDate
    })

    const getModeBadge = (mode: LeaveMode) =>
        mode === 'AdHoc' ? (
            <Badge variant="destructive" className="text-xs">AdHoc</Badge>
        ) : (
            <Badge variant="secondary" className="text-xs">Plan</Badge>
        )

    const getStatusBadge = (status: LeaveStatus) => {
        switch (status) {
            case 'pending': return <Badge className="bg-yellow-600 text-white">Pending</Badge>
            case 'approved': return <Badge className="bg-green-600 text-white">Approved</Badge>
            case 'rejected': return <Badge className="bg-red-600 text-white">Rejected</Badge>
        }
    }

    const formatLeaveDateRange = (req: LeaveRequest) => {
        const from = req.fromDate.toDate()
        const to = req.toDate.toDate()
        if (req.type === 'slot') return format(from, 'MMM dd, yyyy')
        if (isSameDay(from, to)) return format(from, 'MMM dd, yyyy')
        return `${format(from, 'MMM dd')} - ${format(to, 'MMM dd, yyyy')}`
    }

    const getTotalDays = (from: Date, to: Date) => differenceInDays(endOfDay(to), startOfDay(from)) + 1

    return (
        <>
            <Card className="h-[73vh]">
                <CardHeader>
                    <CardTitle>Leave Management</CardTitle>
                    <CardDescription>View, review, and manage employee leave requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-6 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 flex-wrap items-end">
                            <div className="relative flex-1 w-1/3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, ID or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={selectedType} onValueChange={handleSelectChange(setSelectedType)}>
                                <SelectTrigger className="w-1/6"><SelectValue placeholder="Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="day">Day Leave</SelectItem>
                                    <SelectItem value="slot">Slot Leave</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={selectedStatus} onValueChange={handleSelectChange(setSelectedStatus)}>
                                <SelectTrigger className="w-1/6"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={selectedMode} onValueChange={handleSelectChange(setSelectedMode)}>
                                <SelectTrigger className="w-1/6"><SelectValue placeholder="Mode" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Modes</SelectItem>
                                    <SelectItem value="AdHoc">AdHoc</SelectItem>
                                    <SelectItem value="Plan">Plan</SelectItem>
                                </SelectContent>
                            </Select>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-1/6 justify-start text-left font-normal", !selectedDate && "text-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(selectedDate, "PPP") : <span className="font-medium">All Dates</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Mode</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRequests.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                                No leave requests found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredRequests.map((req) => (
                                            <TableRow key={req.id} className={cn(req.status === 'pending' && 'font-bold')}>
                                                <TableCell>{req.user?.employeeId || '-'}</TableCell>
                                                <TableCell className="font-medium">
                                                    {req.user
                                                        ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email
                                                        : 'Loading...'}
                                                </TableCell>
                                                <TableCell className="text-sm">{formatLeaveDateRange(req)}</TableCell>
                                                <TableCell className="capitalize">{req.type === 'day' ? 'Full Day' : 'Slot'}</TableCell>
                                                <TableCell>{req.mode && getModeBadge(req.mode)}</TableCell>
                                                <TableCell>
                                                    <Select value={req.status} onValueChange={(v: LeaveStatus) => updateStatus(req.id, v)}>
                                                        <SelectTrigger className="w-[120px]">
                                                            <SelectValue>{getStatusBadge(req.status)}</SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pending"><Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge></SelectItem>
                                                            <SelectItem value="approved"><Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge></SelectItem>
                                                            <SelectItem value="rejected"><Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge></SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => {
                                                        setSelectedRequest(req)
                                                        setIsDialogOpen(true)
                                                    }}>
                                                        View Request
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="text-red-600" onClick={() => deleteRequest(req.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Detailed View Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="border-b pb-6">
                        <DialogTitle className="text-3xl font-bold">Leave Request Details</DialogTitle>
                        <DialogDescription>Full details of the leave application</DialogDescription>
                    </DialogHeader>

                    {selectedRequest && (
                        <div className="mt-8 space-y-8">
                            {/* Employee Info */}
                            <div className="bg-card rounded-xl border p-6 shadow">
                                <h3 className="font-semibold text-lg mb-4">Employee Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <Label className="text-muted-foreground">Employee ID</Label>
                                        <p className="font-semibold">{selectedRequest.user?.employeeId || '—'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Name</Label>
                                        <p className="font-semibold">
                                            {selectedRequest.user
                                                ? `${selectedRequest.user.firstName || ''} ${selectedRequest.user.lastName || ''}`.trim() || selectedRequest.user.email
                                                : 'Unknown'}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Email</Label>
                                        <p>{selectedRequest.user?.email || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-card rounded-xl border p-6">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Leave Type</span><Badge>{selectedRequest.type === 'day' ? 'Full Day' : 'Time Slot'}</Badge></div>
                                    <div className="flex justify-between mt-4"><span className="text-muted-foreground">Leave Mode</span>{selectedRequest.mode && getModeBadge(selectedRequest.mode)}</div>
                                </div>
                                <div className="bg-card rounded-xl border p-6 text-center">
                                    <Label className="text-muted-foreground">Status</Label>
                                    <div className="mt-2">{getStatusBadge(selectedRequest.status)}</div>
                                    <p className="text-xs text-muted-foreground mt-3">
                                        Applied: {format(selectedRequest.appliedAt.toDate(), 'PPP p')}
                                    </p>
                                </div>
                            </div>

                            {selectedRequest.description && (
                                <div className="bg-card rounded-xl border p-6">
                                    <Label className="font-semibold">Reason</Label>
                                    <p className="mt-3 text-lg pl-4 border-l-4 border-primary/50">
                                        {selectedRequest.description}
                                    </p>
                                </div>
                            )}

                            {/* Date & Slot */}
                            <div className="bg-muted/50 rounded-xl border p-8">
                                {selectedRequest.type === 'day' ? (
                                    <div className="grid grid-cols-3 gap-6 text-center">
                                        <div>
                                            <Label className="text-muted-foreground">From</Label>
                                            <p className="text-2xl font-bold text-primary mt-2">
                                                {format(selectedRequest.fromDate.toDate(), 'MMM dd, yyyy')}
                                            </p>
                                            <p className="text-sm">{format(selectedRequest.fromDate.toDate(), 'EEEE')}</p>
                                        </div>
                                        <div className="flex items-center justify-center">
                                            <ArrowBigRight className="w-12 h-12 text-primary" />
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground">To</Label>
                                            <p className="text-2xl font-bold text-primary mt-2">
                                                {format(selectedRequest.toDate.toDate(), 'MMM dd, yyyy')}
                                            </p>
                                            <p className="text-sm">{format(selectedRequest.toDate.toDate(), 'EEEE')}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-6">
                                        <div className='text-left'>
                                            <Label className="text-muted-foreground text-lg">Leave Date</Label>
                                            <p className="text-3xl font-bold text-primary mt-2">
                                                {format(selectedRequest.fromDate.toDate(), 'EEEE, MMMM dd, yyyy')}
                                            </p>
                                        </div>
                                        {selectedRequest.slotIndex != null && selectedRequest.slotIndex >= 0 && selectedRequest.slotIndex < timeSlots.length && (
                                            <div className="bg-card rounded-2xl p-8 border-2 border-primary/20">
                                                <Label className="text-lg text-muted-foreground">Selected Time Slot</Label>
                                                <p className="text-3xl font-extrabold text-primary mt-6">
                                                    {timeSlots[selectedRequest.slotIndex]}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mt-10 text-center bg-card rounded-xl py-6 border">
                                    <Label className="text-lg text-muted-foreground">Total Duration</Label>
                                    <p className="text-3xl font-extrabold text-primary mt-3">
                                        {selectedRequest.type === 'day'
                                            ? `${getTotalDays(selectedRequest.fromDate.toDate(), selectedRequest.toDate.toDate())} Day${getTotalDays(selectedRequest.fromDate.toDate(), selectedRequest.toDate.toDate()) > 1 ? 's' : ''}`
                                            : '01 Slot'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}

export default AdminLeave