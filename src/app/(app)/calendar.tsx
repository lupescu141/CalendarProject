import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "../../ctx";
import { SignOutPrompt } from "../../components/sign-out-prompt";
import {
    acknowledgeUserNotification,
    appendUserAssignmentMessage,
    listUserAssignments,
    listUserNotifications,
    type AssignmentRecord,
} from "../../lib/adminApi";

type FeedbackMessage = { speaker: string; text: string };

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const statusLabels = ["TO DO", "IN PROGRESS", "OVERDUE", "DONE"] as const;
const statusColors = ["#E8E8E8", "#777777", "#D6453D", "#3D8B5C"];
const statusTextColors = ["#333333", "#FFFFFF", "#FFFFFF", "#FFFFFF"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dueDateKey(assignment: AssignmentRecord) {
  return assignment.end_date.slice(0, 10);
}

function monthCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function parseFeedback(feedback: string | null): FeedbackMessage[] {
  if (!feedback) return [];

  const messages: FeedbackMessage[] = [];
  const pattern = /<#([^>]+)#>([\s\S]*?)(?:<\(#\1#\)>|<#\1#>)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(feedback)) !== null) {
    if (match[2].trim()) messages.push({ speaker: match[1], text: match[2].trim() });
  }

  return messages.length ? messages : [{ speaker: "ADMIN", text: feedback.trim() }];
}

function statusLabel(status: number) {
  return statusLabels[status] ?? "TO DO";
}

function AssignmentRow({ assignment, onPress }: { assignment: AssignmentRecord; onPress: (assignment: AssignmentRecord) => void }) {
  const dueDate = new Date(`${dueDateKey(assignment)}T12:00:00`);
  return (
    <Pressable accessibilityLabel={`Open assignment ${assignment.name}`} accessibilityRole="button" onPress={() => onPress(assignment)} style={styles.assignmentRow}>
      <View style={[styles.assignmentAccent, { backgroundColor: statusColors[assignment.status] ?? statusColors[0] }]} />
      <View style={styles.assignmentDate}>
        <Text style={styles.assignmentDay}>{dueDate.getDate()}</Text>
        <Text style={styles.assignmentMonth}>{dueDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</Text>
      </View>
      <View style={styles.assignmentInfo}>
        <Text numberOfLines={1} style={styles.assignmentName}>{assignment.name}</Text>
        <Text numberOfLines={1} style={styles.assignmentDue}>DUE {formatDate(assignment.end_date)}</Text>
        <Text style={[styles.assignmentStatus, { color: statusColors[assignment.status] === "#E8E8E8" ? "#555555" : statusColors[assignment.status] }]}>{statusLabel(assignment.status)}</Text>
      </View>
      {assignment.important === 1 && <Ionicons name="notifications" size={17} color="#D6453D" />}
      <Ionicons name="chevron-forward" size={18} color="#888888" />
    </Pressable>
  );
}

export default function Calendar() {
  const router = useRouter();
  const { currentUser, signOut } = useSession();
  const userId = currentUser?.id;
  const today = new Date();
  const todayKey = dateKey(today);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [notifications, setNotifications] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRecord | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [signOutPromptOpen, setSignOutPromptOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const [userAssignments, userNotifications] = await Promise.all([
          listUserAssignments(userId),
          listUserNotifications(userId),
        ]);
        if (active) {
          setAssignments(userAssignments);
          setNotifications(userNotifications);
          setSelectedAssignment((current) => current
            ? userAssignments.find((assignment) => assignment.id === current.id) ?? null
            : null);
          setError("");
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Assignments could not be loaded.");
      } finally {
        refreshing = false;
        if (active) setLoading(false);
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [userId]);

  const cells = monthCells(month);
  const selectedAssignments = assignments
    .filter((assignment) => dueDateKey(assignment) === selectedDate)
    .sort((left, right) => left.end_date.localeCompare(right.end_date));
  const upcomingAssignments = assignments
    .filter((assignment) => dueDateKey(assignment) > selectedDate)
    .sort((left, right) => left.end_date.localeCompare(right.end_date));

  function replaceAssignment(updated: AssignmentRecord) {
    setAssignments((current) => current.map((assignment) => assignment.id === updated.id ? updated : assignment));
    setSelectedAssignment((current) => current?.id === updated.id ? updated : current);
  }

  async function openNotifications() {
    setNotificationMenuOpen(true);
    if (!userId) return;
    setNotificationLoading(true);
    try {
      setNotifications(await listUserNotifications(userId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Notifications could not be loaded.");
    } finally {
      setNotificationLoading(false);
    }
  }

  async function openAssignmentFromNotification(assignment: AssignmentRecord) {
    if (!userId) return;
    try {
      const seenAssignment = await acknowledgeUserNotification(userId, assignment.id);
      replaceAssignment(seenAssignment);
      setNotifications((current) => current.filter((item) => item.id !== seenAssignment.id));
      setSelectedAssignment(seenAssignment);
      setChatDraft("");
      setNotificationMenuOpen(false);
      setError("");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Notification could not be marked as seen.");
    }
  }

  async function sendMessage() {
    if (!userId || !selectedAssignment || !chatDraft.trim()) return;
    setMessageSending(true);
    setError("");
    try {
      const updated = await appendUserAssignmentMessage(userId, selectedAssignment.id, chatDraft.trim());
      replaceAssignment(updated);
      setChatDraft("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Message could not be sent.");
    } finally {
      setMessageSending(false);
    }
  }

  function openAssignment(assignment: AssignmentRecord) {
    setSelectedAssignment(assignment);
    setChatDraft("");
  }

  if (!currentUser) {
    return <View style={styles.emptyScreen}><Text style={styles.emptyTitle}>Sign in required</Text><Text style={styles.emptyCopy}>Your session does not include a user profile.</Text></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Sign out" accessibilityRole="button" hitSlop={8} onPress={() => setSignOutPromptOpen(true)}><Ionicons name="arrow-back" size={22} color="#111111" /></Pressable>
        <Text style={styles.brandName}><Text style={styles.brandFirst}>first</Text><Text style={styles.brandStop}>stop</Text></Text>
        <Pressable accessibilityLabel={`Notifications, ${notifications.length} unread`} accessibilityRole="button" hitSlop={8} onPress={() => void openNotifications()} style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={21} color="#111111" />
          {notifications.length > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{notifications.length > 9 ? "9+" : notifications.length}</Text></View>}
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <View><Text style={styles.kicker}>YOUR ASSIGNMENTS</Text><Text style={styles.heading}>{month.toLocaleDateString("en-US", { month: "long" })} <Text style={styles.headingYear}>{month.getFullYear()}</Text></Text></View>
        <View style={styles.monthControls}>
          <Pressable accessibilityLabel="Previous month" accessibilityRole="button" onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} style={styles.monthButton}><Ionicons name="chevron-back" size={17} color="#111111" /></Pressable>
          <Pressable accessibilityLabel="Next month" accessibilityRole="button" onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} style={styles.monthButton}><Ionicons name="chevron-forward" size={17} color="#111111" /></Pressable>
        </View>
      </View>
      <Text style={styles.greeting}>For {currentUser.firstname} {currentUser.surname}</Text>

      <View style={styles.calendar}>
        <View style={styles.weekdayRow}>{weekdays.map((weekday) => <Text key={weekday} style={styles.weekday}>{weekday}</Text>)}</View>
        <View style={styles.dateGrid}>
          {cells.map((date) => {
            const key = dateKey(date);
            const selected = key === selectedDate;
            const isToday = key === todayKey;
            const inMonth = date.getMonth() === month.getMonth();
            const hasAssignments = assignments.some((assignment) => dueDateKey(assignment) === key);
            return (
              <Pressable accessibilityLabel={`Select ${key}`} accessibilityRole="button" key={key} onPress={() => setSelectedDate(key)} style={styles.dateCell}>
                <View style={[styles.dateNumber, isToday && styles.todayDate, selected && styles.selectedDate]}><Text style={[styles.dateText, !inMonth && styles.mutedDate, selected && styles.selectedDateText]}>{date.getDate()}</Text></View>
                <View style={[styles.assignmentDot, hasAssignments && styles.hasAssignmentDot, selected && hasAssignments && styles.selectedAssignmentDot]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading ? <View style={styles.loading}><ActivityIndicator color="#D6453D" /><Text style={styles.loadingText}>Loading your assignments...</Text></View> : <>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>DUE {formatDate(selectedDate).toUpperCase()}</Text><Text style={styles.count}>{selectedAssignments.length} ITEMS</Text></View>
        {selectedAssignments.length === 0 ? <Text style={styles.emptyCopy}>No assignments are due on this day.</Text> : <View style={styles.assignmentList}>{selectedAssignments.map((assignment) => <AssignmentRow assignment={assignment} key={assignment.id} onPress={openAssignment} />)}</View>}
        <View style={[styles.sectionHeader, styles.upcomingHeader]}><Text style={styles.sectionTitle}>UPCOMING</Text><Text style={styles.count}>{upcomingAssignments.length} ITEMS</Text></View>
        {upcomingAssignments.length === 0 ? <Text style={styles.emptyCopy}>No upcoming assignments.</Text> : <View style={styles.assignmentList}>{upcomingAssignments.map((assignment) => <AssignmentRow assignment={assignment} key={assignment.id} onPress={openAssignment} />)}</View>}
      </>}

      <Modal animationType="slide" onRequestClose={() => setNotificationMenuOpen(false)} transparent visible={notificationMenuOpen}>
        <View style={styles.modalBackdrop}><View style={styles.notificationSheet}>
          <View style={styles.modalHeader}><View><Text style={styles.modalKicker}>INBOX</Text><Text style={styles.modalTitle}>Notifications</Text></View><Pressable accessibilityLabel="Close notifications" accessibilityRole="button" onPress={() => setNotificationMenuOpen(false)}><Ionicons name="close" size={22} color="#111111" /></Pressable></View>
          {notificationLoading ? <ActivityIndicator color="#D6453D" /> : notifications.length === 0 ? <Text style={styles.emptyCopy}>No unread assignment notifications.</Text> : <ScrollView showsVerticalScrollIndicator={false}>{notifications.map((assignment) => <Pressable accessibilityLabel={`Open notification for ${assignment.name}`} accessibilityRole="button" key={assignment.id} onPress={() => void openAssignmentFromNotification(assignment)} style={styles.notificationRow}><View style={styles.notificationIcon}><Ionicons name="notifications" size={17} color="#D6453D" /></View><View style={styles.notificationInfo}><Text style={styles.notificationTitle}>{assignment.name}</Text><Text style={styles.notificationDescription} numberOfLines={2}>{assignment.description}</Text><Text style={styles.notificationDue}>DUE {formatDate(assignment.end_date)}</Text></View><Ionicons name="chevron-forward" size={18} color="#888888" /></Pressable>)}</ScrollView>}
        </View></View>
      </Modal>

      <SignOutPrompt
        visible={signOutPromptOpen}
        onCancel={() => setSignOutPromptOpen(false)}
        onConfirm={() => { signOut(); router.replace("/sign-in"); }}
      />

      <Modal animationType="slide" onRequestClose={() => setSelectedAssignment(null)} transparent visible={selectedAssignment !== null}>
        <View style={styles.modalBackdrop}><View style={styles.detailSheet}>
          {selectedAssignment && <>
            <View style={styles.modalHeader}><View style={styles.detailHeading}><Text style={styles.modalKicker}>ASSIGNMENT</Text><Text style={styles.modalTitle}>{selectedAssignment.name}</Text></View><Pressable accessibilityLabel="Close assignment" accessibilityRole="button" onPress={() => setSelectedAssignment(null)}><Ionicons name="close" size={22} color="#111111" /></Pressable></View>
            <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.detailMetaRow}><Text style={styles.detailMeta}>DUE {formatDate(selectedAssignment.end_date)}</Text><Text style={[styles.detailStatus, { backgroundColor: statusColors[selectedAssignment.status] ?? statusColors[0], color: statusTextColors[selectedAssignment.status] ?? statusTextColors[0] }]}>{statusLabel(selectedAssignment.status)}</Text></View>
              <Text style={styles.assignmentDescription}>{selectedAssignment.description}</Text>
              <View style={styles.chatHeader}><Text style={styles.sectionTitle}>CONVERSATION</Text><Ionicons name="chatbubbles-outline" size={17} color="#777777" /></View>
              {parseFeedback(selectedAssignment.feedback).map((entry, index) => {
                const isUser = entry.speaker.toUpperCase() === "USER";
                const isNotification = entry.speaker.toUpperCase() === "NOTIFICATION";
                return <View key={`${entry.speaker}-${index}`} style={[styles.chatBubble, isUser && styles.userBubble, isNotification && styles.notificationBubble]}><Text style={styles.chatSpeaker}>{isUser ? "YOU" : entry.speaker.toUpperCase()}</Text><Text style={styles.chatText}>{entry.text}</Text></View>;
              })}
              {!selectedAssignment.feedback && <Text style={styles.emptyCopy}>No messages yet. Start the conversation with your admin.</Text>}
              <TextInput accessibilityLabel="Message to admin" multiline onChangeText={setChatDraft} placeholder="Write a message to your admin..." placeholderTextColor="#999999" style={styles.chatInput} value={chatDraft} />
              {!!error && <Text accessibilityRole="alert" style={styles.chatError}>{error}</Text>}
              <Pressable accessibilityRole="button" disabled={messageSending || !chatDraft.trim()} onPress={() => void sendMessage()} style={[styles.sendButton, (messageSending || !chatDraft.trim()) && styles.disabledButton]}><Text style={styles.sendButtonText}>{messageSending ? "SENDING..." : "SEND MESSAGE"}</Text><Ionicons name="send" size={17} color="#FFFFFF" /></Pressable>
            </ScrollView>
          </>}
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: "#FFFFFF", flexGrow: 1, paddingBottom: 40, paddingHorizontal: 24, paddingTop: 24 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 43 },
  brandName: { fontSize: 18, fontWeight: "800", letterSpacing: 0.2 }, brandFirst: { color: "#111111" }, brandStop: { color: "#D6453D" },
  bellButton: { alignItems: "center", borderColor: "#DDDDDD", borderRadius: 5, borderWidth: 1, height: 38, justifyContent: "center", position: "relative", width: 38 },
  notificationBadge: { alignItems: "center", backgroundColor: "#D6453D", borderColor: "#FFFFFF", borderRadius: 9, borderWidth: 1, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 4, position: "absolute", right: -5, top: -6 }, notificationBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  titleRow: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }, kicker: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 9 }, heading: { color: "#111111", fontSize: 29, fontWeight: "900" }, headingYear: { color: "#999999", fontWeight: "500" }, greeting: { color: "#777777", fontSize: 13, marginBottom: 22 },
  monthControls: { flexDirection: "row", gap: 6 }, monthButton: { alignItems: "center", borderColor: "#D6D6D6", borderRadius: 4, borderWidth: 1, height: 32, justifyContent: "center", width: 32 },
  calendar: { borderColor: "#DDDDDD", borderRadius: 5, borderWidth: 1, marginBottom: 30, padding: 13 }, weekdayRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 13 }, weekday: { color: "#999999", fontSize: 9, fontWeight: "800", textAlign: "center", width: "14.28%" }, dateGrid: { flexDirection: "row", flexWrap: "wrap" }, dateCell: { alignItems: "center", height: 42, justifyContent: "flex-start", width: "14.28%" }, dateNumber: { alignItems: "center", borderRadius: 18, height: 29, justifyContent: "center", width: 29 }, todayDate: { borderColor: "#D6453D", borderWidth: 1 }, selectedDate: { backgroundColor: "#D6453D" }, dateText: { color: "#333333", fontSize: 12, fontWeight: "700" }, mutedDate: { color: "#BDBDBD" }, selectedDateText: { color: "#FFFFFF" }, assignmentDot: { backgroundColor: "transparent", borderRadius: 3, height: 4, marginTop: 3, width: 4 }, hasAssignmentDot: { backgroundColor: "#D6453D" }, selectedAssignmentDot: { backgroundColor: "#FFFFFF" },
  sectionHeader: { alignItems: "center", borderBottomColor: "#DDDDDD", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingBottom: 12 }, upcomingHeader: { marginTop: 31 }, sectionTitle: { color: "#111111", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }, count: { color: "#999999", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, assignmentList: { paddingTop: 4 }, assignmentRow: { alignItems: "center", borderBottomColor: "#EEEEEE", borderBottomWidth: 1, flexDirection: "row", minHeight: 79, paddingVertical: 12 }, assignmentAccent: { borderRadius: 2, height: 38, marginRight: 12, width: 3 }, assignmentDate: { alignItems: "center", marginRight: 14, width: 33 }, assignmentDay: { color: "#111111", fontSize: 18, fontWeight: "900" }, assignmentMonth: { color: "#999999", fontSize: 8, fontWeight: "900", marginTop: 1 }, assignmentInfo: { flex: 1, minWidth: 0 }, assignmentName: { color: "#111111", fontSize: 14, fontWeight: "800" }, assignmentDue: { color: "#888888", fontSize: 9, fontWeight: "700", marginTop: 4 }, assignmentStatus: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7, marginTop: 4 }, assignmentDescription: { color: "#555555", fontSize: 14, lineHeight: 21, marginBottom: 24, marginTop: 16 },
  loading: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 22 }, loadingText: { color: "#777777", fontSize: 13 }, emptyCopy: { color: "#777777", fontSize: 13, lineHeight: 19, paddingVertical: 17 }, error: { color: "#B53A33", fontSize: 12, marginBottom: 12, marginTop: -16 }, chatError: { color: "#B53A33", fontSize: 12, marginTop: 8 }, emptyScreen: { alignItems: "center", backgroundColor: "#FFFFFF", flex: 1, justifyContent: "center", padding: 30 }, emptyTitle: { color: "#111111", fontSize: 22, fontWeight: "900", marginBottom: 8 },
  modalBackdrop: { backgroundColor: "rgba(17,17,17,0.4)", flex: 1, justifyContent: "flex-end" }, notificationSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 10, borderTopRightRadius: 10, maxHeight: "78%", minHeight: 230, padding: 24, paddingBottom: 32 }, detailSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 10, borderTopRightRadius: 10, maxHeight: "90%", minHeight: "55%", padding: 24, paddingBottom: 30 }, modalHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 22 }, modalKicker: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7 }, modalTitle: { color: "#111111", flexShrink: 1, fontSize: 22, fontWeight: "900" }, notificationRow: { alignItems: "center", borderBottomColor: "#EEEEEE", borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 13 }, notificationIcon: { alignItems: "center", backgroundColor: "#FFF0EE", borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, notificationInfo: { flex: 1, minWidth: 0 }, notificationTitle: { color: "#111111", fontSize: 14, fontWeight: "800" }, notificationDescription: { color: "#777777", fontSize: 11, lineHeight: 15, marginTop: 3 }, notificationDue: { color: "#D6453D", fontSize: 9, fontWeight: "900", letterSpacing: 0.6, marginTop: 5 }, detailHeading: { flex: 1, paddingRight: 16 }, detailContent: { paddingBottom: 8 }, detailMetaRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, detailMeta: { color: "#888888", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, detailStatus: { borderRadius: 3, fontSize: 9, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 }, chatHeader: { alignItems: "center", borderBottomColor: "#DDDDDD", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10 }, chatBubble: { alignSelf: "flex-start", backgroundColor: "#F1F1F1", borderRadius: 6, marginBottom: 8, maxWidth: "88%", padding: 11 }, userBubble: { alignSelf: "flex-end", backgroundColor: "#F1D9D6" }, notificationBubble: { alignSelf: "center", backgroundColor: "#FFF0EE", borderColor: "#F0C2BE", borderWidth: 1, maxWidth: "100%" }, chatSpeaker: { color: "#777777", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 4 }, chatText: { color: "#222222", fontSize: 13, lineHeight: 18 }, chatInput: { borderColor: "#D6D6D6", borderRadius: 5, borderWidth: 1, color: "#111111", height: 75, marginTop: 12, padding: 12, textAlignVertical: "top" }, sendButton: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 5, flexDirection: "row", height: 49, justifyContent: "space-between", marginTop: 10, paddingHorizontal: 16 }, sendButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }, disabledButton: { opacity: 0.55 },
});