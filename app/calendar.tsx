import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type EventStatus = "NEW" | "IN PROGRESS" | "DONE";
type CalendarEvent = { date: string; description?: string; id: number; status: EventStatus; time: string; title: string };

const statuses: EventStatus[] = ["NEW", "IN PROGRESS", "DONE"];
const statusColors: Record<EventStatus, string> = { NEW: "#D6453D", "IN PROGRESS": "#666666", DONE: "#111111" };
const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const today = new Date();
const todayKey = dateKey(today);
const initialEvents: CalendarEvent[] = [
  { date: todayKey, description: "Align on priorities and share quick updates with the team.", id: 1, status: "NEW", time: "09:00", title: "Team stand-up" },
  { date: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)), description: "Review the latest calendar experience and collect feedback.", id: 2, status: "IN PROGRESS", time: "13:30", title: "Design review" },
  { date: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4)), id: 3, status: "DONE", time: "18:00", title: "Dinner with Maya" },
];
function monthCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
}
function displayDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return { day: String(date.getDate()), month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase() };
}

function EventRow({ event, onPress }: { event: CalendarEvent; onPress: (event: CalendarEvent) => void }) {
  const date = displayDate(event.date);
  return (
    <Pressable accessibilityLabel={`Open details for ${event.title}`} accessibilityRole="button" onPress={() => onPress(event)} style={styles.eventRow}>
      <View style={[styles.eventAccent, { backgroundColor: statusColors[event.status] }]} />
      <View style={styles.eventDate}><Text style={styles.eventDay}>{date.day}</Text><Text style={styles.eventMonth}>{date.month}</Text></View>
      <View style={styles.eventDetails}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventTime}>{event.time}</Text><Text style={[styles.inlineStatus, { color: statusColors[event.status] }]}>{event.status}</Text></View>
      <Ionicons name="ellipsis-horizontal" size={21} color="#777777" />
    </Pressable>
  );
}

export default function Calendar() {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [eventDate, setEventDate] = useState(todayKey);
  const [eventStatus, setEventStatus] = useState<EventStatus>("NEW");
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<EventStatus>("NEW");
  const cells = monthCells(month);
  const selectedEvents = events.filter((event) => event.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const futureEvents = events.filter((event) => event.date > selectedDate).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  function addEvent() {
    if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return;
    setEvents((current) => [...current, { date: eventDate, description: description.trim() || undefined, id: Date.now(), status: eventStatus, time: time.trim() || "ALL DAY", title: title.trim() }]);
    setSelectedDate(eventDate); setMonth(new Date(`${eventDate}T12:00:00`)); setTitle(""); setDescription(""); setTime(""); setShowComposer(false);
  }
  function openSettings(event: CalendarEvent) {
    setEditingEvent(event); setEditTitle(event.title); setEditDescription(event.description || ""); setEditDate(event.date); setEditStatus(event.status);
  }
  function saveSettings() {
    if (!editingEvent || !editTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(editDate)) return;
    setEvents((current) => current.map((event) => event.id === editingEvent.id ? { ...event, date: editDate, description: editDescription.trim() || undefined, status: editStatus, title: editTitle.trim() } : event));
    setSelectedDate(editDate); setMonth(new Date(`${editDate}T12:00:00`)); setEditingEvent(null);
  }
  function openAddEvent() {
    setEventDate(selectedDate);
    setViewingEvent(null);
    setShowComposer(true);
  }
  const selectedDisplay = displayDate(selectedDate);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color="#111111" /></Pressable><Text style={styles.brandName}><Text style={styles.brandFirst}>first</Text><Text style={styles.brandStop}>stop</Text></Text><Pressable accessibilityLabel="Add event" accessibilityRole="button" hitSlop={8} onPress={openAddEvent} style={styles.headerAdd}><Ionicons name="add" size={23} color="#FFFFFF" /></Pressable></View>
      <View style={styles.titleRow}><View><Text style={styles.kicker}>YOUR CALENDAR</Text><Text style={styles.heading}>{month.toLocaleDateString("en-US", { month: "long" })} <Text style={styles.headingYear}>{month.getFullYear()}</Text></Text></View><View style={styles.monthControls}><Pressable accessibilityLabel="Previous month" accessibilityRole="button" onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} style={styles.monthButton}><Ionicons name="chevron-back" size={17} color="#111111" /></Pressable><Pressable accessibilityLabel="Next month" accessibilityRole="button" onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} style={styles.monthButton}><Ionicons name="chevron-forward" size={17} color="#111111" /></Pressable></View></View>
      <View style={styles.calendar}><View style={styles.weekdayRow}>{weekdays.map((weekday) => <Text key={weekday} style={styles.weekday}>{weekday}</Text>)}</View><View style={styles.dateGrid}>{cells.map((date) => { const key = dateKey(date); const selected = key === selectedDate; const isToday = key === todayKey; const current = date.getMonth() === month.getMonth(); const dateEvents = events.filter((event) => event.date === key); return <Pressable accessibilityLabel={`Select ${key}`} accessibilityRole="button" key={key} onPress={() => setSelectedDate(key)} style={styles.dateCell}><View style={[styles.dateNumber, isToday && styles.todayDate, selected && styles.selectedDate]}><Text style={[styles.dateText, !current && styles.mutedDate, selected && styles.selectedDateText]}>{date.getDate()}</Text></View><View style={styles.dotRow}>{dateEvents.map((event) => <View key={event.id} style={[styles.eventDot, { backgroundColor: selected ? "#FFFFFF" : statusColors[event.status] }]} />)}</View></Pressable>; })}</View></View>

      <Modal animationType="slide" onRequestClose={() => setShowComposer(false)} transparent visible={showComposer}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.composerTitle}>ADD AN EVENT</Text><Pressable accessibilityLabel="Close add event" accessibilityRole="button" onPress={() => setShowComposer(false)}><Ionicons name="close" size={22} color="#111111" /></Pressable></View><TextInput onChangeText={setTitle} placeholder="Event name" placeholderTextColor="#999999" style={styles.composerInput} value={title} /><TextInput onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor="#999999" style={styles.composerInput} value={description} /><View style={styles.modalRow}><TextInput onChangeText={setEventDate} placeholder="YYYY-MM-DD" placeholderTextColor="#999999" style={[styles.composerInput, styles.halfInput]} value={eventDate} /><TextInput onChangeText={setTime} placeholder="Time" placeholderTextColor="#999999" style={[styles.composerInput, styles.halfInput]} value={time} /></View><Text style={styles.modalLabel}>STATUS</Text><StatusPicker value={eventStatus} onChange={setEventStatus} /><Pressable accessibilityRole="button" onPress={addEvent} style={styles.saveButton}><Text style={styles.saveButtonText}>SAVE EVENT</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable></View></View></Modal>
      <Modal animationType="fade" onRequestClose={() => setViewingEvent(null)} transparent visible={viewingEvent !== null}><View style={styles.modalBackdrop}><View style={styles.detailCard}>{viewingEvent && <><View style={styles.modalHeader}><Text style={styles.composerTitle}>EVENT DETAILS</Text><Pressable accessibilityLabel="Close event details" accessibilityRole="button" onPress={() => setViewingEvent(null)}><Ionicons name="close" size={22} color="#111111" /></Pressable></View><Text style={styles.detailTitle}>{viewingEvent.title}</Text><Text style={styles.detailMeta}>{displayDate(viewingEvent.date).month} {displayDate(viewingEvent.date).day}  ·  {viewingEvent.time}</Text><Text style={styles.detailDescription}>{viewingEvent.description || "No detailed explanation was added for this event."}</Text><View style={styles.detailActions}><Pressable accessibilityRole="button" onPress={() => { setViewingEvent(null); openSettings(viewingEvent); }} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>EVENT SETTINGS</Text></Pressable><Pressable accessibilityRole="button" onPress={openAddEvent} style={styles.smallAddButton}><Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.smallAddText}>NEW EVENT</Text></Pressable></View></>}</View></View></Modal>
      <Modal animationType="slide" onRequestClose={() => setEditingEvent(null)} transparent visible={editingEvent !== null}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.composerTitle}>EVENT SETTINGS</Text><Pressable accessibilityLabel="Close event settings" accessibilityRole="button" onPress={() => setEditingEvent(null)}><Ionicons name="close" size={22} color="#111111" /></Pressable></View><TextInput onChangeText={setEditTitle} placeholder="Event name" placeholderTextColor="#999999" style={styles.composerInput} value={editTitle} /><TextInput onChangeText={setEditDescription} placeholder="Description (optional)" placeholderTextColor="#999999" style={styles.composerInput} value={editDescription} /><TextInput onChangeText={setEditDate} placeholder="YYYY-MM-DD" placeholderTextColor="#999999" style={styles.composerInput} value={editDate} /><Text style={styles.modalLabel}>STATUS</Text><StatusPicker value={editStatus} onChange={setEditStatus} /><Pressable accessibilityRole="button" onPress={saveSettings} style={styles.saveButton}><Text style={styles.saveButtonText}>SAVE CHANGES</Text><Ionicons name="checkmark" size={18} color="#FFFFFF" /></Pressable></View></View></Modal>

      <View style={styles.eventsHeader}><Text style={styles.sectionTitle}>EVENTS ON {selectedDisplay.month} {selectedDisplay.day}</Text><Text style={styles.eventCount}>{selectedEvents.length} EVENTS</Text></View>
      {selectedEvents.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyText}>Nothing planned for this day.</Text></View> : <View style={styles.eventList}>{selectedEvents.map((event) => <EventRow event={event} key={event.id} onPress={setViewingEvent} />)}</View>}
      <View style={styles.eventsHeader}><Text style={styles.sectionTitle}>UPCOMING EVENTS</Text><Text style={styles.eventCount}>{futureEvents.length} EVENTS</Text></View>
      {futureEvents.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyText}>No future events yet.</Text></View> : <View style={styles.eventList}>{futureEvents.map((event) => <EventRow event={event} key={event.id} onPress={setViewingEvent} />)}</View>}
    </ScrollView>
  );
}

function StatusPicker({ value, onChange }: { value: EventStatus; onChange: (status: EventStatus) => void }) {
  return <View style={styles.statusPicker}>{statuses.map((status) => <Pressable accessibilityRole="button" key={status} onPress={() => onChange(status)} style={[styles.statusOption, value === status && { backgroundColor: statusColors[status] }]}><Text style={[styles.statusOptionText, value === status && styles.activeStatusText]}>{status}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  content: { backgroundColor: "#FFFFFF", flexGrow: 1, paddingBottom: 38, paddingHorizontal: 24, paddingTop: 24 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 48 }, brandName: { fontSize: 18, fontWeight: "800", letterSpacing: 0.2 }, brandFirst: { color: "#111111" }, brandStop: { color: "#D6453D" }, headerAdd: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 5, height: 38, justifyContent: "center", width: 38 }, titleRow: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", marginBottom: 29 }, kicker: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 9 }, heading: { color: "#111111", fontSize: 29, fontWeight: "900", letterSpacing: -0.7 }, headingYear: { color: "#999999", fontWeight: "500" }, monthControls: { flexDirection: "row", gap: 6 }, monthButton: { alignItems: "center", borderColor: "#D6D6D6", borderRadius: 4, borderWidth: 1, height: 32, justifyContent: "center", width: 32 }, calendar: { borderColor: "#DDDDDD", borderRadius: 5, borderWidth: 1, padding: 13 }, weekdayRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 13 }, weekday: { color: "#999999", fontSize: 9, fontWeight: "800", textAlign: "center", width: "14.28%" }, dateGrid: { flexDirection: "row", flexWrap: "wrap" }, dateCell: { alignItems: "center", height: 42, justifyContent: "flex-start", width: "14.28%" }, dateNumber: { alignItems: "center", borderRadius: 18, height: 29, justifyContent: "center", width: 29 }, todayDate: { borderColor: "#D6453D", borderWidth: 1 }, selectedDate: { backgroundColor: "#D6453D" }, dateText: { color: "#333333", fontSize: 12, fontWeight: "700" }, mutedDate: { color: "#BDBDBD" }, selectedDateText: { color: "#FFFFFF" }, dotRow: { flexDirection: "row", gap: 2, height: 7, marginTop: 3 }, eventDot: { borderRadius: 2, height: 4, width: 4 }, modalBackdrop: { backgroundColor: "rgba(17,17,17,0.4)", flex: 1, justifyContent: "flex-end" }, modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 12, borderTopRightRadius: 12, gap: 12, padding: 24, paddingBottom: 34 }, detailCard: { backgroundColor: "#FFFFFF", borderRadius: 10, gap: 12, margin: 24, padding: 24 }, modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }, composerTitle: { color: "#111111", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }, composerInput: { backgroundColor: "#F2F2F2", borderColor: "#D5D5D5", borderRadius: 4, borderWidth: 1, color: "#111111", fontSize: 14, height: 47, paddingHorizontal: 12 }, modalRow: { flexDirection: "row", gap: 10 }, halfInput: { flex: 1 }, modalLabel: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginTop: 4 }, statusPicker: { flexDirection: "row", gap: 7 }, statusOption: { alignItems: "center", borderColor: "#D5D5D5", borderRadius: 4, borderWidth: 1, flex: 1, height: 37, justifyContent: "center" }, statusOptionText: { color: "#666666", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 }, activeStatusText: { color: "#FFFFFF" }, saveButton: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 4, flexDirection: "row", height: 48, justifyContent: "space-between", marginTop: 6, paddingHorizontal: 14 }, saveButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 1.3 }, detailTitle: { color: "#111111", fontSize: 28, fontWeight: "900" }, detailMeta: { color: "#D6453D", fontSize: 12, fontWeight: "800", letterSpacing: 0.8 }, detailDescription: { color: "#555555", fontSize: 15, lineHeight: 23, minHeight: 46 }, detailActions: { flexDirection: "row", gap: 8, marginTop: 8 }, secondaryButton: { alignItems: "center", borderColor: "#111111", borderRadius: 4, borderWidth: 1, flex: 1, height: 44, justifyContent: "center" }, secondaryButtonText: { color: "#111111", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, smallAddButton: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 4, flex: 1, flexDirection: "row", gap: 5, height: 44, justifyContent: "center" }, smallAddText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, eventsHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14, marginTop: 35 }, sectionTitle: { color: "#111111", flex: 1, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 }, eventCount: { color: "#999999", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, emptyState: { alignItems: "center", borderColor: "#DDDDDD", borderRadius: 4, borderWidth: 1, padding: 25 }, emptyText: { color: "#888888", fontSize: 13 }, eventList: { gap: 10 }, eventRow: { alignItems: "center", backgroundColor: "#F2F2F2", borderRadius: 4, flexDirection: "row", minHeight: 82, paddingRight: 12 }, eventAccent: { alignSelf: "stretch", borderBottomLeftRadius: 4, borderTopLeftRadius: 4, marginRight: 12, width: 5 }, eventDate: { alignItems: "center", borderRightColor: "#D5D5D5", borderRightWidth: 1, justifyContent: "center", minHeight: 48, paddingRight: 10, width: 53 }, eventDay: { color: "#111111", fontSize: 21, fontWeight: "900", lineHeight: 22 }, eventMonth: { color: "#777777", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, eventDetails: { flex: 1, gap: 4, paddingLeft: 11 }, eventTitle: { color: "#111111", fontSize: 14, fontWeight: "800" }, eventTime: { color: "#777777", fontSize: 12 }, inlineStatus: { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
});
