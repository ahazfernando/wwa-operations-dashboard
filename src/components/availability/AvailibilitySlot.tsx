"use client";

import React, { useState, useEffect, useMemo } from "react";
import { format, startOfWeek, addWeeks, subWeeks, parseISO } from "date-fns";
import {
    collection,
    query,
    onSnapshot,
    doc,
    updateDoc,
    getDoc,
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
    PopoverTrigger,
    PopoverContent,
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
import { useToast } from "@/components/ui/use-toast";

const timeSlots = Array.from({ length: 20 }, (_, i) => {
    const hour = (i + 4) % 24;
    const next = (hour + 1) % 24;
    const fmt = (h: number): string => {
        const period = h >= 12 ? "PM" : "AM";
        const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${display}:00 ${period}`;
    };
    return `${fmt(hour)} – ${fmt(next)}`;
});

const formatTimeBlock = (indices: number[]): string => {
    if (indices.length === 0) return "N/A";
    const start = (indices[0] + 4) % 24;
    const end = (indices[indices.length - 1] + 5) % 24;
    const fmt = (h: number): string => {
        const period = h >= 12 ? "PM" : "AM";
        const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${display}:00 ${period}`;
    };
    return `${fmt(start)} – ${fmt(end)}`;
};

interface User {
    uid: string;
    displayName: string;
}

interface RawSlot {
    id: string;
    docId: string;
    uid: string;
    userName: string;
    date: string;
    timeIndex: number;
    status: "approved" | "pending" | "request-add" | "request-remove";
    weekStart: string;
}

type IntentType = "requesting" | "remove" | "pending" | "approved";

interface Block {
    blockId: string;
    uid: string;
    userName: string;
    date: string;
    dateFormatted: string;
    timeIndices: number[];
    timeLabel: string;
    intent: IntentType;
    docId: string;
}

interface ModalSlot {
    id: string;
    timeIndex: number;
    timeLabel: string;
    intent: IntentType;
    docId: string;
    status: RawSlot["status"];
}

interface GroupedModalSlot {
    date: string;
    dateFormatted: string;
    slots: ModalSlot[];
}

export default function AvailabilityRequests() {
    const { toast } = useToast();

    const [users, setUsers] = useState<User[]>([]);
    const [allSlots, setAllSlots] = useState<RawSlot[]>([]);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [filterUser, setFilterUser] = useState("all");
    const [filterIntent, setFilterIntent] = useState("all");
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<{ uid: string; name: string } | null>(null);
    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<"approved" | "rejected" | "pending">("approved");

    const weekKey = format(currentWeek, "yyyy-MM-dd");

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "users"), (snap) => {
            const list: User[] = [{ uid: "all", displayName: "All Users" }];
            snap.forEach((d) => {
                const data = d.data();
                const firstName = data.firstName as string | undefined;
                const lastName = data.lastName as string | undefined;
                if (firstName && lastName) {
                    list.push({
                        uid: d.id,
                        displayName: `${firstName} ${lastName}`,
                    });
                }
            });
            setUsers(list.sort((a, b) => a.displayName.localeCompare(b.displayName)));
        });
        return unsub;
    }, []);

    useEffect(() => {
        const q = query(collection(db, "weeklyAvailability"));
        const unsub = onSnapshot(q, (snapshot) => {
            const slots: RawSlot[] = [];

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const uid = data.uid as string | undefined;
                const weekStart = data.weekStart as string | undefined;
                const slotsData = data.slots as Record<string, { timeIndex: number; status: string }[]> | undefined;

                if (!uid || !weekStart || !slotsData) return;

                const userName = users.find((u) => u.uid === uid)?.displayName || "Unknown User";

                Object.entries(slotsData).forEach(([date, daySlots]) => {
                    daySlots.forEach((slot) => {
                        slots.push({
                            id: `${docSnap.id}-${date}-${slot.timeIndex}`,
                            docId: docSnap.id,
                            uid,
                            userName,
                            date,
                            timeIndex: slot.timeIndex,
                            status: slot.status as RawSlot["status"],
                            weekStart,
                        });
                    });
                });
            });

            setAllSlots(slots);
        });

        return unsub;
    }, [users]);

    // Helper to safely map status → intent
    const getIntent = (status: RawSlot["status"]): IntentType => {
        switch (status) {
            case "request-add":
                return "requesting";
            case "request-remove":
                return "remove";
            case "pending":
                return "pending";
            case "approved":
                return "approved";
            default:
                return "pending"; // fallback
        }
    };

    const getIntentLabel = (intent: IntentType): string => {
        return intent.charAt(0).toUpperCase() + intent.slice(1);
    };

    const getIntentColor = (intent: IntentType): string => {
        switch (intent) {
            case "requesting":
                return "bg-yellow-100 text-yellow-800";
            case "remove":
                return "bg-red-100 text-red-800";
            case "pending":
                return "bg-blue-100 text-blue-800";
            case "approved":
                return "bg-green-100 text-green-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const blocks = useMemo(() => {
        let filtered = allSlots.filter((s) => s.weekStart === weekKey);

        if (filterUser !== "all") filtered = filtered.filter((s) => s.uid === filterUser);
        if (filterIntent !== "all") {
            const targetIntent = filterIntent as IntentType;
            filtered = filtered.filter((s) => getIntent(s.status) === targetIntent);
        }
        if (selectedDate) {
            const d = format(selectedDate, "yyyy-MM-dd");
            filtered = filtered.filter((s) => s.date === d);
        }

        const map = new Map<string, RawSlot[]>();
        filtered.forEach((s) => {
            const intent = getIntent(s.status);
            const key = `${s.uid}-${s.date}-${intent}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(s);
        });

        const result: Block[] = [];
        map.forEach((items) => {
            const sorted = items.sort((a, b) => a.timeIndex - b.timeIndex);
            let current: number[] = [sorted[0].timeIndex];

            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].timeIndex === sorted[i - 1].timeIndex + 1) {
                    current.push(sorted[i].timeIndex);
                } else {
                    result.push({
                        blockId: `${items[0].docId}-${items[0].date}-${current.join(",")}`,
                        uid: items[0].uid,
                        userName: items[0].userName,
                        date: items[0].date,
                        dateFormatted: format(parseISO(items[0].date), "EEE, MMM dd"),
                        timeIndices: current,
                        timeLabel: formatTimeBlock(current),
                        intent: getIntent(items[0].status),
                        docId: items[0].docId,
                    });
                    current = [sorted[i].timeIndex];
                }
            }
            result.push({
                blockId: `${items[0].docId}-${items[0].date}-${current.join(",")}`,
                uid: items[0].uid,
                userName: items[0].userName,
                date: items[0].date,
                dateFormatted: format(parseISO(items[0].date), "EEE, MMM dd"),
                timeIndices: current,
                timeLabel: formatTimeBlock(current),
                intent: getIntent(items[0].status),
                docId: items[0].docId,
            });
        });

        return result.sort((a, b) => {
            if (a.userName !== b.userName) return a.userName.localeCompare(b.userName);
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.timeIndices[0] - b.timeIndices[0];
        });
    }, [allSlots, weekKey, filterUser, filterIntent, selectedDate]);

    const groupedModalSlots = useMemo((): GroupedModalSlot[] => {
        if (!selectedEmployee) return [];

        const filtered = allSlots.filter(
            (s) => s.uid === selectedEmployee.uid && s.weekStart === weekKey
        );

        const map = new Map<string, GroupedModalSlot>();
        filtered.forEach((s) => {
            const intent = getIntent(s.status);

            if (!map.has(s.date)) {
                map.set(s.date, {
                    date: s.date,
                    dateFormatted: format(parseISO(s.date), "EEE, MMM dd"),
                    slots: [],
                });
            }
            map.get(s.date)!.slots.push({
                id: s.id,
                timeIndex: s.timeIndex,
                timeLabel: timeSlots[s.timeIndex],
                intent,
                docId: s.docId,
                status: s.status,
            });
        });

        return Array.from(map.values()).map((group) => ({
            ...group,
            slots: group.slots.sort((a, b) => a.timeIndex - b.timeIndex),
        }));
    }, [selectedEmployee, allSlots, weekKey]);

    const openEmployeeModal = (uid: string, name: string) => {
        setSelectedEmployee({ uid, name });
        setSelectedSlots(new Set());
        setBulkAction("approved");
        setModalOpen(true);
    };

    const handleBulkAction = async () => {
        if (selectedSlots.size === 0) return;

        const slotsToUpdate = allSlots.filter((s) => selectedSlots.has(s.id));
        const docMap = new Map<string, RawSlot[]>();
        slotsToUpdate.forEach((s) => {
            if (!docMap.has(s.docId)) docMap.set(s.docId, []);
            docMap.get(s.docId)!.push(s);
        });

        for (const [docId, slots] of docMap) {
            const docRef = doc(db, "weeklyAvailability", docId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) continue;

            const data = snap.data();
            const currentSlots = { ...(data.slots || {}) } as Record<
                string,
                { timeIndex: number; status: string }[]
            >;

            if (bulkAction === "approved") {
                slots.forEach((slot) => {
                    const daySlots = currentSlots[slot.date] || [];
                    const idx = daySlots.findIndex((s) => s.timeIndex === slot.timeIndex);
                    if (idx !== -1) {
                        daySlots[idx] = { timeIndex: slot.timeIndex, status: "approved" };
                    } else {
                        daySlots.push({ timeIndex: slot.timeIndex, status: "approved" });
                    }
                    currentSlots[slot.date] = daySlots;
                });
            } else if (bulkAction === "rejected") {
                slots.forEach((slot) => {
                    if (currentSlots[slot.date]) {
                        currentSlots[slot.date] = currentSlots[slot.date].filter(
                            (s) => s.timeIndex !== slot.timeIndex
                        );
                        if (currentSlots[slot.date].length === 0) delete currentSlots[slot.date];
                    }
                });
            } else if (bulkAction === "pending") {
                slots.forEach((slot) => {
                    const daySlots = currentSlots[slot.date] || [];
                    const idx = daySlots.findIndex((s) => s.timeIndex === slot.timeIndex);
                    if (idx !== -1) {
                        daySlots[idx] = { timeIndex: slot.timeIndex, status: "pending" };
                    }
                    currentSlots[slot.date] = daySlots;
                });
            }

            await updateDoc(docRef, { slots: currentSlots });
        }

        toast({
            title: "Success",
            description: `Action "${bulkAction}" applied to ${selectedSlots.size} slot(s)`,
        });
        setSelectedSlots(new Set());
    };

    const handleDeleteSlot = async (slotId: string) => {
        const slot = allSlots.find((s) => s.id === slotId);
        if (!slot) return;

        const docRef = doc(db, "weeklyAvailability", slot.docId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const currentSlots = { ...(data.slots || {}) } as Record<
            string,
            { timeIndex: number; status: string }[]
        >;

        if (currentSlots[slot.date]) {
            currentSlots[slot.date] = currentSlots[slot.date].filter(
                (s) => s.timeIndex !== slot.timeIndex
            );
            if (currentSlots[slot.date].length === 0) delete currentSlots[slot.date];
        }

        await updateDoc(docRef, { slots: currentSlots });
        setSelectedSlots((prev) => {
            const next = new Set(prev);
            next.delete(slotId);
            return next;
        });

        toast({ title: "Deleted", description: "Slot removed successfully" });
    };

    return (
        <>
            <Card className="h-auto lg:h-[90vh] overflow-y-auto">
                <CardHeader>
                    <CardTitle>Availability Requests</CardTitle>
                    <CardDescription>
                        Click employee name to review and approve individual time slots
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="flex flex-wrap items-center gap-5">
                        <div className="flex items-center gap-6">
                            <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="font-semibold flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5" />
                                Week of {format(currentWeek, "MMM dd, yyyy")}
                            </div>
                            <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <Select value={filterUser} onValueChange={setFilterUser}>
                            <SelectTrigger className="w-60">
                                <SelectValue />
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
                            <SelectTrigger className="w-60">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="requesting">Requesting Add</SelectItem>
                                <SelectItem value="remove">Requesting Remove</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                            </SelectContent>
                        </Select>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-60 justify-start">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "PPP") : "Filter by date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee Name</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Time Block</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {blocks.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                            No availability requests match your filters
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    blocks.map((block, i) => {
                                        const prev = i > 0 ? blocks[i - 1] : null;
                                        const isFirstUser = !prev || prev.uid !== block.uid;
                                        const isFirstDate = !prev || prev.uid !== block.uid || prev.date !== block.date;

                                        let userSpan = 0;
                                        let dateSpan = 0;
                                        if (isFirstUser) {
                                            for (let j = i; j < blocks.length; j++) {
                                                if (blocks[j].uid === block.uid) userSpan++;
                                                else break;
                                            }
                                        }
                                        if (isFirstDate) {
                                            for (let j = i; j < blocks.length; j++) {
                                                if (blocks[j].uid === block.uid && blocks[j].date === block.date) dateSpan++;
                                                else break;
                                            }
                                        }

                                        return (
                                            <TableRow key={block.blockId}>
                                                {isFirstUser && (
                                                    <TableCell rowSpan={userSpan} className="font-semibold">
                                                        <button
                                                            onClick={() => openEmployeeModal(block.uid, block.userName)}
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            {block.userName}
                                                        </button>
                                                    </TableCell>
                                                )}
                                                {isFirstDate && <TableCell rowSpan={dateSpan}>{block.dateFormatted}</TableCell>}
                                                <TableCell>
                                                    <Badge variant="secondary">{block.timeLabel}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn("font-medium", getIntentColor(block.intent))}>
                                                        {getIntentLabel(block.intent)}
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
                                        const allIds = groupedModalSlots.flatMap((g) => g.slots.map((s) => s.id));
                                        const allSelected = allIds.every((id) => selectedSlots.has(id));
                                        setSelectedSlots(allSelected ? new Set() : new Set(allIds));
                                    }}
                                >
                                    {groupedModalSlots.flatMap((g) => g.slots).every((s) => selectedSlots.has(s.id))
                                        ? "Deselect All"
                                        : "Select All"}
                                </Button>

                                <Select value={bulkAction} onValueChange={(v) => setBulkAction(v as any)}>
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
                                        group.slots.map((slot, idx) => {
                                            const isFirst = idx === 0;
                                            const rowSpan = group.slots.length;

                                            return (
                                                <TableRow key={slot.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedSlots.has(slot.id)}
                                                            onCheckedChange={(checked) => {
                                                                setSelectedSlots((prev) => {
                                                                    const next = new Set(prev);
                                                                    if (checked) next.add(slot.id);
                                                                    else next.delete(slot.id);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                    </TableCell>

                                                    {isFirst && (
                                                        <TableCell rowSpan={rowSpan} className="font-medium">
                                                            {group.dateFormatted}
                                                        </TableCell>
                                                    )}

                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">
                                                            {slot.timeLabel}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell>
                                                        <Badge className={cn("font-medium", getIntentColor(slot.intent))}>
                                                            {getIntentLabel(slot.intent)}
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