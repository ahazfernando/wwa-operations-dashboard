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
import { Search, CalendarIcon, Trash2 } from 'lucide-react'
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
    startSlot?: number
    endSlot?: number
    description?: string
    status: LeaveStatus
    appliedAt: Timestamp
    mode?: LeaveMode
}

const timeSlots = (() => {
    const slots: string[] = []
    let current = new Date(2000, 0, 1, 4, 0)
    const midnight = new Date(2000, 0, 2, 0, 0)
    while (current < midnight) {
        const end = new Date(current.getTime() + 60 * 60 * 1000)
        slots.push(
            `${format(current, 'h:mm a').replace(':00', '').toUpperCase()} - ${format(end, 'h:mm a').replace(':00', '').toUpperCase()}`
        )
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
            const expiryTime = endOfDay(leaveEndDate)

            if (isBefore(expiryTime, now)) {
                try {
                    await deleteDoc(doc(db, 'leaveRequests', req.id))
                    console.log(`Auto-deleted expired leave: ${req.id}`)
                } catch (err) {
                    console.error('Auto-delete failed:', req.id, err)
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
                    console.error('Error fetching user profile:', err)
                }

                const mode = determineLeaveMode(data.fromDate)

                requests.push({
                    id: d.id,
                    uid: data.uid,
                    user: userProfile || { email: 'Unknown User' },
                    type: data.type,
                    fromDate: data.fromDate,
                    toDate: data.toDate,
                    startSlot: data.startSlot,
                    endSlot: data.endSlot,
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
            toast({
                title: 'Success',
                description: `Leave request ${newStatus}.`,
            })
        } catch (err) {
            toast({
                title: 'Error',
                description: 'Failed to update status',
                variant: 'destructive',
            })
        }
    }

    const deleteRequest = async (id: string) => {
        if (!confirm('Permanently delete this leave request?')) return

        try {
            await deleteDoc(doc(db, 'leaveRequests', id))
            toast({
                title: 'Deleted',
                description: 'Leave request removed permanently.',
            })
        } catch (err) {
            toast({
                title: 'Error',
                description: 'Failed to delete request',
                variant: 'destructive',
            })
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
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
            case 'approved':
                return <Badge className="bg-green-100 text-green-800">Approved</Badge>
            case 'rejected':
                return <Badge className="bg-red-100 text-red-800">Rejected</Badge>
        }
    }

    const formatLeaveDateRange = (req: LeaveRequest) => {
        const from = req.fromDate.toDate()
        const to = req.toDate.toDate()

        if (req.type === 'slot') {
            return format(from, 'MMM dd, yyyy')
        }

        if (isSameDay(from, to)) {
            return format(from, 'MMM dd, yyyy')
        }

        return `${format(from, 'MMM dd')} - ${format(to, 'MMM dd, yyyy')}`
    }

    // Calculate total days (inclusive)
    const getTotalDays = (from: Date, to: Date) => {
        return differenceInDays(endOfDay(to), startOfDay(from)) + 1
    }

    // Get slot count and formatted string
    const getSlotInfo = (startSlot?: number, endSlot?: number) => {
        if (startSlot === undefined || endSlot === undefined) return { count: 0, text: '' }
        const count = endSlot - startSlot + 1
        const startText = timeSlots[startSlot]?.split(' - ')[0] || ''
        const endText = timeSlots[endSlot]?.split(' - ')[1] || ''
        return { count, text: `${startText} - ${endText}` }
    }

    return (
        <>
            <Card className='h-[73vh] overflow-y-auto'>
                <CardHeader>
                    <CardTitle>Leave Management</CardTitle>
                    <CardDescription>View, review, and manage employee leave applications.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-6 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 flex-wrap items-end">
                            <div className="relative flex-1 min-w-[250px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, employee ID or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            <Select value={selectedType} onValueChange={handleSelectChange(setSelectedType)}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Leave Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="day">Day Leave</SelectItem>
                                    <SelectItem value="slot">Slot Leave</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={selectedStatus} onValueChange={handleSelectChange(setSelectedStatus)}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={selectedMode} onValueChange={handleSelectChange(setSelectedMode)}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Leave Mode" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Modes</SelectItem>
                                    <SelectItem value="AdHoc">AdHoc</SelectItem>
                                    <SelectItem value="Plan">Plan</SelectItem>
                                </SelectContent>
                            </Select>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn("w-[250px] justify-start text-left font-normal", !selectedDate && "text-foreground")}
                                    >
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

                    <div className="rounded-md border">
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
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            No leave requests found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRequests.map((req) => (
                                        <TableRow
                                            key={req.id}
                                            className={cn(
                                                req.status === 'pending' && 'font-bold text-foreground'
                                            )}
                                        >
                                            <TableCell>{req.user?.employeeId || '-'}</TableCell>
                                            <TableCell className="font-medium">
                                                {req.user
                                                    ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email
                                                    : 'Loading...'}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {formatLeaveDateRange(req)}
                                            </TableCell>
                                            <TableCell className="capitalize">
                                                {req.type === 'day' ? 'Full Day' : 'Slot'}
                                            </TableCell>
                                            <TableCell>{req.mode && getModeBadge(req.mode)}</TableCell>
                                            <TableCell>
                                                <Select value={req.status} onValueChange={(value: LeaveStatus) => updateStatus(req.id, value)}>
                                                    <SelectTrigger className="w-[120px]">
                                                        <SelectValue>{getStatusBadge(req.status)}</SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">
                                                            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
                                                        </SelectItem>
                                                        <SelectItem value="approved">
                                                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
                                                        </SelectItem>
                                                        <SelectItem value="rejected">
                                                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedRequest(req)
                                                        setIsDialogOpen(true)
                                                    }}
                                                >
                                                    View Request
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-red-600 hover:bg-red-50"
                                                    onClick={() => deleteRequest(req.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Delete</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Leave Request Details</DialogTitle>
                        <DialogDescription>Full details of the employee's leave request</DialogDescription>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-6">
                                <div><Label>Employee ID</Label><p className="font-medium">{selectedRequest.user?.employeeId || '—'}</p></div>
                                <div><Label>Name</Label><p className="font-medium">
                                    {selectedRequest.user
                                        ? `${selectedRequest.user.firstName || ''} ${selectedRequest.user.lastName || ''}`.trim() || selectedRequest.user.email
                                        : '—'}
                                </p></div>
                                <div><Label>Leave Mode</Label><div className="mt-2">{selectedRequest.mode && getModeBadge(selectedRequest.mode)}</div></div>
                                <div><Label>Leave Type</Label><p className="font-medium capitalize">
                                    {selectedRequest.type === 'day' ? 'Full Day Leave' : 'Slot Leave'}
                                </p></div>

                                {selectedRequest.type === 'day' ? (
                                    <>
                                        <div><Label>From Date</Label><p className="font-medium">{format(selectedRequest.fromDate.toDate(), 'PPP')}</p></div>
                                        <div><Label>To Date</Label><p className="font-medium">{format(selectedRequest.toDate.toDate(), 'PPP')}</p></div>
                                        <div className="col-span-2">
                                            <Label>Total Duration</Label>
                                            <p className="font-bold text-lg text-primary">
                                                {getTotalDays(selectedRequest.fromDate.toDate(), selectedRequest.toDate.toDate())} day(s)
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div><Label>Leave Date</Label><p className="font-medium">{format(selectedRequest.fromDate.toDate(), 'PPP')}</p></div>
                                        <div><Label>Time Slots</Label>
                                            <p className="font-medium">
                                                {getSlotInfo(selectedRequest.startSlot, selectedRequest.endSlot).text}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <Label>Total Slots</Label>
                                            <p className="font-bold text-lg text-primary">
                                                {getSlotInfo(selectedRequest.startSlot, selectedRequest.endSlot).count} slot(s)
                                            </p>
                                        </div>
                                    </>
                                )}

                                {selectedRequest.type === 'day' && (
                                    <div className="col-span-2">
                                        <Label>Description</Label>
                                        <p className="font-medium mt-1">{selectedRequest.description || 'No description provided'}</p>
                                    </div>
                                )}

                                <div><Label>Status</Label><div className="mt-2">{getStatusBadge(selectedRequest.status)}</div></div>
                                <div><Label>Applied On</Label><p className="font-medium">
                                    {format(selectedRequest.appliedAt.toDate(), 'PPP p')}
                                </p></div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}

export default AdminLeave