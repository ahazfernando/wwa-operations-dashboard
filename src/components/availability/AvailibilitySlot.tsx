"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    format,
    startOfWeek,
    addWeeks,
    subWeeks,
    parseISO,
} from "date-fns";
import {
    collection,
    query,
    onSnapshot,
    doc,
    updateDoc,
    getDoc,
    deleteField,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Time Slot Formatter ---------- */
const formatHour = (hour24: number): string => {
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const period = hour24 >= 12 ? "PM" : "AM";
    return `${hour12}:00 ${period}`;
};

const hourlySlots = Array.from({ length: 20 }, (_, i) => {
    const startHour = (i + 4) % 24;
    const endHour = (startHour + 1) % 24;
    return {
        index: i,
        fullLabel: `${formatHour(startHour)} – ${formatHour(endHour)}`,
    };
});

interface User {
    uid: string;
    displayName: string;
}

interface RawRequestSlot {
    id: string;
    docId: string;
    uid: string;
    userName: string;
    date: string;
    timeIndex: number;
    intent: "requesting" | "remove" | "pending" | "approved";
    status: "pending" | "approved" | "rejected";
    weekStart: string;
}

interface RequestBlock {
    blockId: string;
    uid: string;
    userName: string;
    date: string;
    dateFormatted: string;
    timeIndices: number[];
    timeLabel: string;
    intent: "requesting" | "remove" | "pending" | "approved";
    docId: string;
}

interface ModalSlot {
    id: string;
    timeIndex: number;
    timeLabel: string;
    intent: "requesting" | "remove" | "pending" | "approved";
    docId: string;
}

interface GroupedModalSlot {
    date: string;
    dateFormatted: string;
    slots: ModalSlot[];
}

export default function AvailabilityRequests() {
    const [users, setUsers] = useState<User[]>([{ uid: "all", displayName: "All Users" }]);
    const [allRequests, setAllRequests] = useState<RawRequestSlot[]>([]);
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [filterUser, setFilterUser] = useState<string>("all");
    const [filterIntent, setFilterIntent] = useState<string>("all");
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<{ uid: string; name: string } | null>(null);
    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<"approved" | "rejected" | "pending">("approved");

    // Load users
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "users"), (snap) => {
            const list: User[] = [{ uid: "all", displayName: "All Users" }];
            snap.forEach((d) => {
                const data = d.data();
                if (data?.firstName && data?.lastName) {
                    list.push({
                        uid: d.id,
                        displayName: `${data.firstName} ${data.lastName}`,
                    });
                }
            });
            setUsers(list.sort((a, b) => a.displayName.localeCompare(b.displayName)));
        });
        return () => unsub();
    }, []);

    // Load requests
    useEffect(() => {
        const q = query(collection(db, "weeklyAvailability"));
        const unsub = onSnapshot(q, (snapshot) => {
            const requests: RawRequestSlot[] = [];

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (!data?.uid || !data?.weekStart) return;

                const uid = data.uid as string;
                const weekStart = data.weekStart as string;
                const status = (data.status ?? "pending") as "pending" | "approved" | "rejected";

                const approvedSlots = (data.slots ?? {}) as Record<string, number[]>;
                const pendingSlots = (data.pendingSlots ?? {}) as Record<string, number[]>;

                const hasPendingChanges = Object.keys(pendingSlots).length > 0;

                let slotsToShow: Record<string, number[]> = {};
                let baseIntent: "requesting" | "remove" | "pending" | "approved" = "pending";

                if (status === "pending" && hasPendingChanges) {
                    slotsToShow = pendingSlots;
                    baseIntent = "pending";
                } else if (status === "pending" && !hasPendingChanges && data.slots) {
                    slotsToShow = data.slots as Record<string, number[]>;
                    baseIntent = "pending";
                } else if (status === "approved") {
                    slotsToShow = approvedSlots;
                    baseIntent = "approved";
                } else {
                    return;
                }

                const userName = users.find((u) => u.uid === uid)?.displayName ?? "Unknown User";

                Object.entries(slotsToShow).forEach(([dateStr, timeIndices]) => {
                    timeIndices.forEach((timeIndex) => {
                        let intent: "requesting" | "remove" | "pending" | "approved" = baseIntent;

                        if (status === "pending" && hasPendingChanges) {
                            const wasApproved = approvedSlots[dateStr]?.includes(timeIndex) ?? false;
                            const isInPending = pendingSlots[dateStr]?.includes(timeIndex) ?? false;

                            if (isInPending && !wasApproved) intent = "requesting";
                            else if (!isInPending && wasApproved) intent = "remove";
                            else intent = "pending";
                        }

                        requests.push({
                            id: `${docSnap.id}-${dateStr}-${timeIndex}`,
                            docId: docSnap.id,
                            uid,
                            userName,
                            date: dateStr,
                            timeIndex,
                            intent,
                            status,
                            weekStart,
                        });
                    });
                });
            });

            setAllRequests(requests);
        });

        return () => unsub();
    }, [users]);

    // MAIN TABLE: Grouped blocks
    const groupedBlocks = useMemo(() => {
        const weekStr = format(currentWeekStart, "yyyy-MM-dd");
        let filtered = allRequests.filter((r) => r.weekStart === weekStr);

        if (filterUser !== "all") filtered = filtered.filter((r) => r.uid === filterUser);
        if (filterIntent !== "all") filtered = filtered.filter((r) => r.intent === filterIntent);
        if (selectedDate) {
            const d = format(selectedDate, "yyyy-MM-dd");
            filtered = filtered.filter((r) => r.date === d);
        }

        const map = new Map<string, RawRequestSlot[]>();
        filtered.forEach((req) => {
            const key = `${req.uid}-${req.date}-${req.intent}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(req);
        });

        const blocks: RequestBlock[] = [];

        map.forEach((slots) => {
            if (slots.length === 0) return;
            const sorted = slots.sort((a, b) => a.timeIndex - b.timeIndex);

            let current: number[] = [sorted[0].timeIndex];
            const groups: number[][] = [];

            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].timeIndex === sorted[i - 1].timeIndex + 1) {
                    current.push(sorted[i].timeIndex);
                } else {
                    groups.push(current);
                    current = [sorted[i].timeIndex];
                }
            }
            groups.push(current);

            groups.forEach((indices) => {
                const startHour = (indices[0] + 4) % 24;
                const endHour = (indices[indices.length - 1] + 5) % 24;
                const timeLabel = `${formatHour(startHour)} – ${formatHour(endHour)}`;

                blocks.push({
                    blockId: `${slots[0].docId}-${slots[0].date}-${indices[0]}-${indices[indices.length - 1]}`,
                    uid: slots[0].uid,
                    userName: slots[0].userName,
                    date: slots[0].date,
                    dateFormatted: format(parseISO(slots[0].date), "EEE, MMM dd"),
                    timeIndices: indices,
                    timeLabel,
                    intent: slots[0].intent,
                    docId: slots[0].docId,
                });
            });
        });

        return blocks.sort((a, b) => {
            if (a.userName !== b.userName) return a.userName.localeCompare(b.userName);
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.timeIndices[0] - b.timeIndices[0];
        });
    }, [allRequests, currentWeekStart, filterUser, filterIntent, selectedDate]);

    // MODAL: Grouped by date, sorted Monday → Sunday
    const groupedModalSlots = useMemo((): GroupedModalSlot[] => {
        if (!selectedEmployee) return [];

        const weekStr = format(currentWeekStart, "yyyy-MM-dd");
        const filtered = allRequests.filter(
            (r) => r.uid === selectedEmployee.uid && r.weekStart === weekStr
        );

        const map = new Map<string, GroupedModalSlot>();

        filtered.forEach((r) => {
            const dateKey = r.date;
            if (!map.has(dateKey)) {
                map.set(dateKey, {
                    date: dateKey,
                    dateFormatted: format(parseISO(dateKey), "EEE, MMM dd"),
                    slots: [],
                });
            }
            map.get(dateKey)!.slots.push({
                id: r.id,
                timeIndex: r.timeIndex,
                timeLabel: hourlySlots[r.timeIndex].fullLabel,
                intent: r.intent,
                docId: r.docId,
            });
        });

        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([_, group]) => ({
                ...group,
                slots: group.slots.sort((a, b) => a.timeIndex - b.timeIndex),
            }));
    }, [selectedEmployee, allRequests, currentWeekStart]);

    const openEmployeeModal = (uid: string, name: string) => {
        setSelectedEmployee({ uid, name });
        setSelectedSlots(new Set());
        setBulkAction("approved");
        setModalOpen(true);
    };

    const handleBulkAction = async () => {
        if (selectedSlots.size === 0) return;

        const slotsToUpdate = allRequests.filter((r) => selectedSlots.has(r.id));
        const docMap = new Map<string, RawRequestSlot[]>();

        slotsToUpdate.forEach((slot) => {
            if (!docMap.has(slot.docId)) docMap.set(slot.docId, []);
            docMap.get(slot.docId)!.push(slot);
        });

        for (const [docId, slots] of docMap) {
            const docRef = doc(db, "weeklyAvailability", docId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) continue;

            const data = snap.data()!;
            const currentSlots = { ...(data.slots ?? {}) } as Record<string, number[]>;

            if (bulkAction === "approved") {
                const updatedSlots = { ...currentSlots };
                slots.forEach((slot) => {
                    if (!updatedSlots[slot.date]) updatedSlots[slot.date] = [];
                    if (!updatedSlots[slot.date].includes(slot.timeIndex)) {
                        updatedSlots[slot.date].push(slot.timeIndex);
                    }
                });
                Object.keys(updatedSlots).forEach((d) => {
                    updatedSlots[d] = Array.from(new Set(updatedSlots[d])).sort((a, b) => a - b);
                    if (updatedSlots[d].length === 0) delete updatedSlots[d];
                });

                await updateDoc(docRef, {
                    slots: updatedSlots,
                    pendingSlots: deleteField(),
                    status: "approved",
                    approvedAt: Timestamp.now(),
                });
            } else if (bulkAction === "rejected") {
                await updateDoc(docRef, {
                    pendingSlots: deleteField(),
                    status: "rejected",
                    rejectedAt: Timestamp.now(),
                });
            } else if (bulkAction === "pending") {
                await updateDoc(docRef, { status: "pending" });
            }
        }

        alert(`${bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} applied to ${selectedSlots.size} slot(s)`);
        setSelectedSlots(new Set());
    };

    const handleDeleteSlot = async (slotId: string) => {
        const slot = allRequests.find((r) => r.id === slotId);
        if (!slot) return;

        const docRef = doc(db, "weeklyAvailability", slot.docId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const data = snap.data()!;
        const pendingSlots = { ...(data.pendingSlots ?? {}) } as Record<string, number[]>;
        const approvedSlots = { ...(data.slots ?? {}) } as Record<string, number[]>;

        // Remove from pending
        if (pendingSlots[slot.date]) {
            pendingSlots[slot.date] = pendingSlots[slot.date].filter((t) => t !== slot.timeIndex);
            if (pendingSlots[slot.date].length === 0) delete pendingSlots[slot.date];
        }

        // Restore if it was a "remove" request
        if (slot.intent === "remove") {
            if (!approvedSlots[slot.date]) approvedSlots[slot.date] = [];
            if (!approvedSlots[slot.date].includes(slot.timeIndex)) {
                approvedSlots[slot.date].push(slot.timeIndex);
                approvedSlots[slot.date].sort((a, b) => a - b);
            }
        }

        const updateData: Record<string, unknown> = { slots: approvedSlots };
        if (Object.keys(pendingSlots).length === 0) {
            updateData.pendingSlots = deleteField();
            updateData.status = Object.keys(approvedSlots).length > 0 ? "approved" : "pending";
        } else {
            updateData.pendingSlots = pendingSlots;
        }

        await updateDoc(docRef, updateData);

        setSelectedSlots((prev) => {
            const next = new Set(prev);
            next.delete(slotId);
            return next;
        });
    };

    const goToPrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
    const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));

    return (
        <>
            <Card className="h-auto lg:h-[93vh] overflow-y-auto">
                <CardHeader>
                    <CardTitle>Availability Requests</CardTitle>
                    <CardDescription>Click employee name to review individual time slots</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-5">
                        <div className="flex items-center gap-8">
                            <Button variant="outline" size="icon" onClick={goToPrevWeek}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center gap-2 font-semibold">
                                <CalendarIcon className="h-5 w-5" />
                                Week of {format(currentWeekStart, "MMM dd, yyyy")}
                            </div>
                            <Button variant="outline" size="icon" onClick={goToNextWeek}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <Select value={filterUser} onValueChange={setFilterUser}>
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="All Users" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((u) => (
                                    <SelectItem key={u.uid} value={u.uid}>
                                        {u.displayName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterIntent} onValueChange={setFilterIntent}>
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="All Changes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Changes</SelectItem>
                                <SelectItem value="requesting">Requesting</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Already Approved</SelectItem>
                            </SelectContent>
                        </Select>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-64 justify-start text-left font-normal",
                                        !selectedDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "PPP") : "Filter by date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* MAIN TABLE */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee Name</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Time Block</TableHead>
                                    <TableHead>Change Type</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedBlocks.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                            No requests match your filters
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    groupedBlocks.map((block, index) => {
                                        const prevBlock = index > 0 ? groupedBlocks[index - 1] : null;
                                        const isFirstForUser = !prevBlock || prevBlock.uid !== block.uid;
                                        const isFirstForDate =
                                            !prevBlock || prevBlock.uid !== block.uid || prevBlock.date !== block.date;

                                        let userRowSpan = 0;
                                        let dateRowSpan = 0;

                                        if (isFirstForUser) {
                                            for (let i = index; i < groupedBlocks.length; i++) {
                                                if (groupedBlocks[i].uid === block.uid) {
                                                    userRowSpan++;
                                                    if (groupedBlocks[i].date === block.date) dateRowSpan++;
                                                } else break;
                                            }
                                        } else if (isFirstForDate) {
                                            for (let i = index; i < groupedBlocks.length; i++) {
                                                if (
                                                    groupedBlocks[i].uid === block.uid &&
                                                    groupedBlocks[i].date === block.date
                                                ) {
                                                    dateRowSpan++;
                                                } else break;
                                            }
                                        }

                                        return (
                                            <TableRow
                                                key={block.blockId}
                                                className={cn(isFirstForUser && "border-t-2 border-t-primary/20")}
                                            >
                                                {isFirstForUser && (
                                                    <TableCell rowSpan={userRowSpan} className="font-semibold">
                                                        <button
                                                            onClick={() => openEmployeeModal(block.uid, block.userName)}
                                                            className="text-blue-600 hover:underline font-medium"
                                                        >
                                                            {block.userName}
                                                        </button>
                                                    </TableCell>
                                                )}
                                                {isFirstForDate && (
                                                    <TableCell rowSpan={dateRowSpan}>{block.dateFormatted}</TableCell>
                                                )}
                                                <TableCell>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {block.timeLabel}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={cn(
                                                            "font-medium border",
                                                            block.intent === "requesting" &&
                                                            "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-300",
                                                            block.intent === "remove" &&
                                                            "bg-red-100 text-red-800 hover:bg-red-100 border-red-300",
                                                            block.intent === "pending" &&
                                                            "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-300",
                                                            block.intent === "approved" &&
                                                            "bg-green-100 text-green-800 hover:bg-green-100 border-green-300"
                                                        )}
                                                    >
                                                        {block.intent === "requesting" && "Requesting"}
                                                        {block.intent === "remove" && "Remove"}
                                                        {block.intent === "pending" && "Pending"}
                                                        {block.intent === "approved" && "Approved"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* MODAL */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Review Availability - {selectedEmployee?.name}</DialogTitle>
                    </DialogHeader>

                    {selectedEmployee && groupedModalSlots.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const allSlotIds = groupedModalSlots.flatMap((g) => g.slots.map((s) => s.id));
                                        const allSelected =
                                            allSlotIds.length > 0 && allSlotIds.every((id) => selectedSlots.has(id));
                                        setSelectedSlots(allSelected ? new Set() : new Set(allSlotIds));
                                    }}
                                    className="text-xs font-medium"
                                >
                                    {(() => {
                                        const allSlotIds = groupedModalSlots.flatMap((g) => g.slots.map((s) => s.id));
                                        const allSelected =
                                            allSlotIds.length > 0 && allSlotIds.every((id) => selectedSlots.has(id));
                                        return allSelected ? "Deselect All" : "Select All";
                                    })()}
                                </Button>

                                <Select value={bulkAction} onValueChange={(v) => setBulkAction(v as "approved" | "rejected" | "pending")}>
                                    <SelectTrigger className="w-48">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="approved">Approve Selected</SelectItem>
                                        <SelectItem value="rejected">Reject Selected</SelectItem>
                                        <SelectItem value="pending">Set Pending</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button
                                    onClick={handleBulkAction}
                                    disabled={selectedSlots.size === 0}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    Apply to Selected ({selectedSlots.size})
                                </Button>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Time Slot</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedModalSlots.map((group) =>
                                        group.slots.map((slot, slotIdx) => {
                                            const isFirstInGroup = slotIdx === 0;
                                            const rowSpan = group.slots.length;

                                            return (
                                                <TableRow key={slot.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedSlots.has(slot.id)}
                                                            onCheckedChange={(checked) => {
                                                                const newSet = new Set(selectedSlots);
                                                                if (checked) newSet.add(slot.id);
                                                                else newSet.delete(slot.id);
                                                                setSelectedSlots(newSet);
                                                            }}
                                                        />
                                                    </TableCell>

                                                    {isFirstInGroup && (
                                                        <TableCell rowSpan={rowSpan} className="font-medium align-top">
                                                            {group.dateFormatted}
                                                        </TableCell>
                                                    )}

                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">
                                                            {slot.timeLabel}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell>
                                                        <Badge
                                                            className={cn(
                                                                slot.intent === "requesting" && "bg-yellow-100 hover:bg-yellow-100 text-yellow-800",
                                                                slot.intent === "remove" && "bg-red-100 hover:bg-red-100 text-red-800",
                                                                slot.intent === "pending" && "bg-blue-100 hover:bg-blue-100 text-blue-800",
                                                                slot.intent === "approved" && "bg-green-100 hover:bg-green-100 text-green-800"
                                                            )}
                                                        >
                                                            {slot.intent.charAt(0).toUpperCase() + slot.intent.slice(1)}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600"
                                                            onClick={() => handleDeleteSlot(slot.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}