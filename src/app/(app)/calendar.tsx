import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "../../ctx";
import { SignOutPrompt } from "../../components/sign-out-prompt";
import { AssignmentAttachments } from "../../components/assignment-attachments";
import { mergeStyleSheets } from "../../lib/mergeStyleSheets";
import {
    acknowledgeUserNotification,
    appendUserAssignmentMessage,
    listUserAssignments,
    listUserNotifications,
    type AssignmentRecord,
    updateUserAssignmentStatus,
} from "../../lib/adminApi";

type FeedbackMessage = { speaker: string; text: string };
type DealershipTab = "tasks" | "upcoming" | "messages";

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const statusLabels = ["TO DO", "IN PROGRESS", "OVERDUE", "DONE"] as const;
const statuses = [0, 1, 2, 3] as const;
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
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [dealershipTab, setDealershipTab] = useState<DealershipTab>("tasks");

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
  const futureAssignments = assignments
    .filter((assignment) => dueDateKey(assignment) >= todayKey && assignment.status !== 3)
    .sort((left, right) => left.end_date.localeCompare(right.end_date));
  const conversationAssignments = assignments
    .filter((assignment) => Boolean(assignment.feedback?.trim()))
    .sort((left, right) => right.date_created.localeCompare(left.date_created));

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

  async function changeAssignmentStatus(status: 0 | 1 | 2 | 3) {
    if (!userId || !selectedAssignment || statusUpdating) return;
    setStatusUpdating(true);
    setError("");
    try {
      replaceAssignment(await updateUserAssignmentStatus(userId, selectedAssignment.id, status));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Assignment status could not be updated.");
    } finally {
      setStatusUpdating(false);
    }
  }

  async function completeAssignment(assignment: AssignmentRecord) {
    if (!userId || statusUpdating) return;
    setStatusUpdating(true);
    setError("");
    try {
      replaceAssignment(await updateUserAssignmentStatus(userId, assignment.id, 3));
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Assignment could not be marked complete.");
    } finally {
      setStatusUpdating(false);
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
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerBrand}><Text style={styles.brandName}>FIRST STOP</Text><Text style={styles.brandSub}>DEALERSHIP</Text></View>
        <Pressable accessibilityLabel={`Notifications, ${notifications.length} unread`} accessibilityRole="button" hitSlop={8} onPress={() => { setDealershipTab("messages"); void openNotifications(); }} style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={20} color="#222222" />
          {notifications.length > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{notifications.length > 9 ? "9+" : notifications.length}</Text></View>}
        </Pressable>
      </View>

      <View style={styles.dealerIdentity}>
        <View style={styles.dealerAvatar}><Text style={styles.dealerAvatarText}>{currentUser.firstname.charAt(0)}{currentUser.surname.charAt(0)}</Text></View>
        <View style={styles.dealerIdentityCopy}><Text style={styles.kicker}>YOUR DEALERSHIP</Text><Text style={styles.greeting}>{currentUser.facility}</Text><Text style={styles.dealerSubline}>For {currentUser.firstname} {currentUser.surname}</Text></View>
      </View>

      <View style={styles.titleRow}>
        <View><Text style={styles.kicker}>{dealershipTab === "tasks" ? "YOUR ASSIGNMENTS" : dealershipTab === "upcoming" ? "PLAN AHEAD" : "TEAM UPDATES"}</Text><Text style={styles.heading}>{dealershipTab === "messages" ? "Messages" : dealershipTab === "upcoming" ? "Upcoming" : <>{month.toLocaleDateString("en-US", { month: "long" })} <Text style={styles.headingYear}>{month.getFullYear()}</Text></>}</Text></View>
        <View style={styles.monthControls}>
          {dealershipTab === "tasks" && <>
            <Pressable accessibilityLabel="Go to today" accessibilityRole="button" onPress={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(todayKey); }} style={styles.todayButton}><Text style={styles.todayButtonText}>TODAY</Text></Pressable>
            <Pressable accessibilityLabel="Previous month" accessibilityRole="button" onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} style={styles.monthButton}><Ionicons name="chevron-back" size={17} color="#333333" /></Pressable>
            <Pressable accessibilityLabel="Next month" accessibilityRole="button" onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} style={styles.monthButton}><Ionicons name="chevron-forward" size={17} color="#333333" /></Pressable>
          </>}
        </View>
      </View>

      {dealershipTab === "tasks" && <View style={styles.calendar}>
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
      </View>}

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading ? <View style={styles.loading}><ActivityIndicator color="#ED1C24" /><Text style={styles.loadingText}>Loading your assignments...</Text></View> : <>
        {dealershipTab === "tasks" && <>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>DUE {formatDate(selectedDate).toUpperCase()}</Text><Text style={styles.count}>{selectedAssignments.length} ITEMS</Text></View>
        {selectedAssignments.length === 0 ? <Text style={styles.emptyCopy}>No assignments are due on this day.</Text> : <View style={styles.assignmentList}>{selectedAssignments.map((assignment) => <AssignmentRow assignment={assignment} key={assignment.id} onPress={openAssignment} />)}</View>}
        {futureAssignments.length > 0 && <Pressable accessibilityRole="button" onPress={() => setDealershipTab("upcoming")} style={styles.upcomingLink}><Text style={styles.upcomingLinkText}>VIEW {futureAssignments.length} MORE UPCOMING TASKS</Text><Ionicons name="arrow-forward" size={15} color="#ED1C24" /></Pressable>}
        </>}
        {dealershipTab === "upcoming" && <>
          {futureAssignments[0] && <View style={styles.nextUpCard}>
            <Text style={styles.nextUpLabel}>NEXT UP</Text>
            <Text style={styles.nextUpName}>{futureAssignments[0].name}</Text>
            <Text style={styles.nextUpDue}>DUE {formatDate(futureAssignments[0].end_date)}</Text>
            <Text numberOfLines={3} style={styles.nextUpDescription}>{futureAssignments[0].description}</Text>
            <View style={styles.nextUpActions}>
              <Pressable accessibilityRole="button" disabled={statusUpdating} onPress={() => void completeAssignment(futureAssignments[0])} style={[styles.completeButton, statusUpdating && styles.disabledButton]}><Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" /><Text style={styles.completeButtonText}>{statusUpdating ? "SAVING..." : "MARK COMPLETE"}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => openAssignment(futureAssignments[0])} style={styles.detailsButton}><Text style={styles.detailsButtonText}>DETAILS</Text></Pressable>
            </View>
          </View>}
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>UPCOMING TASKS</Text><Text style={styles.count}>{futureAssignments.length} OPEN</Text></View>
          {futureAssignments.length === 0 ? <Text style={styles.emptyCopy}>You’re all caught up. New assignments will appear here.</Text> : <View style={styles.assignmentList}>{futureAssignments.map((assignment) => <AssignmentRow assignment={assignment} key={assignment.id} onPress={openAssignment} />)}</View>}
        </>}
        {dealershipTab === "messages" && <>
          <Pressable accessibilityRole="button" onPress={() => void openNotifications()} style={styles.inboxCard}>
            <View style={styles.inboxIcon}><Ionicons name="notifications-outline" size={18} color="#ED1C24" /></View><View style={styles.inboxCopy}><Text style={styles.inboxTitle}>Notifications</Text><Text style={styles.inboxSub}>{notifications.length ? `${notifications.length} unread assignment update${notifications.length === 1 ? "" : "s"}` : "No unread assignment updates"}</Text></View><Ionicons name="chevron-forward" size={17} color="#858585" />
          </Pressable>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>ASSIGNMENT CONVERSATIONS</Text><Text style={styles.count}>{conversationAssignments.length} THREADS</Text></View>
          {conversationAssignments.length === 0 ? <Text style={styles.emptyCopy}>Messages about your tasks will appear here.</Text> : <View style={styles.assignmentList}>{conversationAssignments.map((assignment) => {
            const messages = parseFeedback(assignment.feedback);
            const lastMessage = messages[messages.length - 1];
            return <Pressable accessibilityLabel={`Open conversation for ${assignment.name}`} accessibilityRole="button" key={assignment.id} onPress={() => openAssignment(assignment)} style={styles.messageRow}>
              <View style={styles.messageIcon}><Ionicons name="chatbubble-ellipses-outline" size={17} color="#C4C4C4" /></View>
              <View style={styles.messageCopy}><Text numberOfLines={1} style={styles.messageTitle}>{assignment.name}</Text><Text numberOfLines={2} style={styles.messagePreview}>{lastMessage?.text ?? "Open conversation"}</Text></View>
              <Ionicons name="chevron-forward" size={17} color="#777777" />
            </Pressable>;
          })}</View>}
        </>}
      </>}

      <Modal animationType="slide" onRequestClose={() => setNotificationMenuOpen(false)} transparent visible={notificationMenuOpen}>
        <View style={styles.modalBackdrop}><View style={styles.notificationSheet}>
          <View style={styles.modalHeader}><View><Text style={styles.modalKicker}>INBOX</Text><Text style={styles.modalTitle}>Notifications</Text></View><Pressable accessibilityLabel="Close notifications" accessibilityRole="button" onPress={() => setNotificationMenuOpen(false)}><Ionicons name="close" size={22} color="#222222" /></Pressable></View>
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
            <View style={styles.modalHeader}><View style={styles.detailHeading}><Text style={styles.modalKicker}>ASSIGNMENT</Text><Text style={styles.modalTitle}>{selectedAssignment.name}</Text></View><Pressable accessibilityLabel="Close assignment" accessibilityRole="button" onPress={() => setSelectedAssignment(null)}><Ionicons name="close" size={22} color="#222222" /></Pressable></View>
            <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.detailMetaRow}><Text style={styles.detailMeta}>DUE {formatDate(selectedAssignment.end_date)}</Text><Text style={[styles.detailStatus, { backgroundColor: statusColors[selectedAssignment.status] ?? statusColors[0], color: statusTextColors[selectedAssignment.status] ?? statusTextColors[0] }]}>{statusLabel(selectedAssignment.status)}</Text></View>
              <Text style={styles.statusPrompt}>UPDATE STATUS</Text>
              <View style={styles.assignmentStatusOptions}>{statuses.map((status) => (
                <Pressable
                  accessibilityLabel={`Set assignment status to ${statusLabels[status]}`}
                  accessibilityRole="button"
                  disabled={statusUpdating}
                  key={status}
                  onPress={() => void changeAssignmentStatus(status)}
                  style={[styles.assignmentStatusOption, { backgroundColor: statusColors[status] }, selectedAssignment.status === status && styles.selectedAssignmentStatus, statusUpdating && styles.disabledButton]}
                >
                  <Text style={[styles.assignmentStatusText, { color: statusTextColors[status] }]}>{statusLabels[status]}</Text>
                </Pressable>
              ))}</View>
              <Text style={styles.assignmentDescription}>{selectedAssignment.description}</Text>
              <View style={styles.chatHeader}><Text style={styles.sectionTitle}>CONVERSATION</Text><Ionicons name="chatbubbles-outline" size={17} color="#777777" /></View>
              {parseFeedback(selectedAssignment.feedback).map((entry, index) => {
                const isUser = entry.speaker.toUpperCase() === "USER";
                const isNotification = entry.speaker.toUpperCase() === "NOTIFICATION";
                return <View key={`${entry.speaker}-${index}`} style={[styles.chatBubble, isUser && styles.userBubble, isNotification && styles.notificationBubble]}><Text style={styles.chatSpeaker}>{isUser ? "YOU" : entry.speaker.toUpperCase()}</Text><Text style={styles.chatText}>{entry.text}</Text></View>;
              })}
              {!selectedAssignment.feedback && <Text style={styles.emptyCopy}>No messages yet. Start the conversation with your admin.</Text>}
              <AssignmentAttachments assignmentId={selectedAssignment.id} uploadedBy="USER" userId={userId} />
              <TextInput accessibilityLabel="Message to admin" multiline onChangeText={setChatDraft} placeholder="Write a message to your admin..." placeholderTextColor="#999999" style={styles.chatInput} value={chatDraft} />
              {!!error && <Text accessibilityRole="alert" style={styles.chatError}>{error}</Text>}
              <Pressable accessibilityRole="button" disabled={messageSending || !chatDraft.trim()} onPress={() => void sendMessage()} style={[styles.sendButton, (messageSending || !chatDraft.trim()) && styles.disabledButton]}><Text style={styles.sendButtonText}>{messageSending ? "SENDING..." : "SEND MESSAGE"}</Text><Ionicons name="send" size={17} color="#FFFFFF" /></Pressable>
            </ScrollView>
          </>}
        </View></View>
      </Modal>
    </ScrollView>
    <View style={styles.bottomNav}>
      {([
        ["tasks", "checkbox-outline", "TASKS"],
        ["upcoming", "calendar-outline", "UPCOMING"],
        ["messages", "chatbubbles-outline", "MESSAGES"],
      ] as const).map(([tab, icon, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: dealershipTab === tab }} key={tab} onPress={() => setDealershipTab(tab)} style={styles.navItem}>
        <View style={styles.navIconWrap}><Ionicons name={icon} size={19} color={dealershipTab === tab ? "#222222" : "#777777"} />{tab === "messages" && notifications.length > 0 && <View style={styles.navBadge} />}</View>
        <Text style={[styles.navLabel, dealershipTab === tab && styles.navLabelActive]}>{label}</Text>
      </Pressable>)}
      <Pressable accessibilityLabel="Sign out" accessibilityRole="button" onPress={() => setSignOutPromptOpen(true)} style={styles.navItem}>
        <Ionicons name="log-out-outline" size={19} color="#777777" /><Text style={styles.navLabel}>SIGN OUT</Text>
      </Pressable>
    </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
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
  modalBackdrop: { backgroundColor: "rgba(17,17,17,0.4)", flex: 1, justifyContent: "flex-end" }, notificationSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 10, borderTopRightRadius: 10, maxHeight: "78%", minHeight: 230, padding: 24, paddingBottom: 32 }, detailSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 10, borderTopRightRadius: 10, maxHeight: "90%", minHeight: "55%", padding: 24, paddingBottom: 30 }, modalHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 22 }, modalKicker: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7 }, modalTitle: { color: "#111111", flexShrink: 1, fontSize: 22, fontWeight: "900" }, notificationRow: { alignItems: "center", borderBottomColor: "#EEEEEE", borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 13 }, notificationIcon: { alignItems: "center", backgroundColor: "#FFF0EE", borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, notificationInfo: { flex: 1, minWidth: 0 }, notificationTitle: { color: "#111111", fontSize: 14, fontWeight: "800" }, notificationDescription: { color: "#777777", fontSize: 11, lineHeight: 15, marginTop: 3 }, notificationDue: { color: "#D6453D", fontSize: 9, fontWeight: "900", letterSpacing: 0.6, marginTop: 5 }, detailHeading: { flex: 1, paddingRight: 16 }, detailContent: { paddingBottom: 8 }, detailMetaRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }, detailMeta: { color: "#888888", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, detailStatus: { borderRadius: 3, fontSize: 9, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 }, statusPrompt: { color: "#777777", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 7 }, assignmentStatusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }, assignmentStatusOption: { alignItems: "center", borderColor: "transparent", borderRadius: 4, borderWidth: 2, justifyContent: "center", minHeight: 30, paddingHorizontal: 8 }, selectedAssignmentStatus: { borderColor: "#111111" }, assignmentStatusText: { fontSize: 9, fontWeight: "900" }, chatHeader: { alignItems: "center", borderBottomColor: "#DDDDDD", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10 }, chatBubble: { alignSelf: "flex-start", backgroundColor: "#F1F1F1", borderRadius: 6, marginBottom: 8, maxWidth: "88%", padding: 11 }, userBubble: { alignSelf: "flex-end", backgroundColor: "#F1D9D6" }, notificationBubble: { alignSelf: "center", backgroundColor: "#FFF0EE", borderColor: "#F0C2BE", borderWidth: 1, maxWidth: "100%" }, chatSpeaker: { color: "#777777", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 4 }, chatText: { color: "#222222", fontSize: 13, lineHeight: 18 }, chatInput: { borderColor: "#D6D6D6", borderRadius: 5, borderWidth: 1, color: "#111111", height: 75, marginTop: 12, padding: 12, textAlignVertical: "top" }, sendButton: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 5, flexDirection: "row", height: 49, justifyContent: "space-between", marginTop: 10, paddingHorizontal: 16 }, sendButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }, disabledButton: { opacity: 0.55 },
});

const styles = mergeStyleSheets(baseStyles, StyleSheet.create({
    screen: { backgroundColor: "#0A0A0A", flex: 1 },
    content: { alignSelf: "center", backgroundColor: "#0A0A0A", borderColor: "#242424", borderLeftWidth: 1, borderRightWidth: 1, flexGrow: 1, maxWidth: 480, paddingBottom: 24, paddingHorizontal: 18, paddingTop: 14, width: "100%" },
    header: { alignItems: "center", borderBottomColor: "#2A2A2A", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 22, paddingBottom: 14 },
    headerBrand: { alignItems: "baseline", flexDirection: "row", gap: 10 },
    brandName: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", letterSpacing: 1.2 },
    brandSub: { color: "#858585", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
    dealerIdentity: { alignItems: "center", backgroundColor: "#121212", borderColor: "#292929", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, marginBottom: 24, padding: 14 },
    dealerAvatar: { alignItems: "center", backgroundColor: "#252525", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
    dealerAvatarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    dealerIdentityCopy: { flex: 1 },
    dealerSubline: { color: "#8A8A8A", fontSize: 11, marginTop: 4 },
    bellButton: { alignItems: "center", backgroundColor: "#161616", borderColor: "#333333", borderRadius: 999, borderWidth: 1, height: 40, justifyContent: "center", position: "relative", width: 40 },
    notificationBadge: { alignItems: "center", backgroundColor: "#ED1C24", borderColor: "#0A0A0A", borderRadius: 9, borderWidth: 1, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 4, position: "absolute", right: -4, top: -5 },
    notificationBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
    titleRow: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
    kicker: { color: "#8A8A8A", fontSize: 9, fontWeight: "800", letterSpacing: 1.6, marginBottom: 6 },
    heading: { color: "#FFFFFF", fontSize: 25, fontWeight: "700" },
    headingYear: { color: "#777777", fontWeight: "500" },
    greeting: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
    monthControls: { alignItems: "center", flexDirection: "row", gap: 6 },
    monthButton: { alignItems: "center", backgroundColor: "#151515", borderColor: "#333333", borderRadius: 8, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
    todayButton: { borderColor: "#444444", borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
    todayButtonText: { color: "#C4C4C4", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
    calendar: { backgroundColor: "#121212", borderColor: "#292929", borderRadius: 14, borderWidth: 1, marginBottom: 22, padding: 12 },
    weekdayRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
    weekday: { color: "#777777", fontSize: 9, fontWeight: "800", textAlign: "center", width: "14.28%" },
    dateGrid: { flexDirection: "row", flexWrap: "wrap" },
    dateCell: { alignItems: "center", height: 43, justifyContent: "flex-start", width: "14.28%" },
    dateNumber: { alignItems: "center", borderRadius: 18, height: 29, justifyContent: "center", width: 29 },
    todayDate: { borderColor: "#ED1C24", borderWidth: 1 },
    selectedDate: { backgroundColor: "#ED1C24" },
    dateText: { color: "#D8D8D8", fontSize: 12, fontWeight: "700" },
    mutedDate: { color: "#4F4F4F" },
    selectedDateText: { color: "#FFFFFF" },
    assignmentDot: { backgroundColor: "transparent", borderRadius: 3, height: 4, marginTop: 3, width: 4 },
    hasAssignmentDot: { backgroundColor: "#ED1C24" },
    selectedAssignmentDot: { backgroundColor: "#FFFFFF" },
    sectionHeader: { alignItems: "center", borderBottomColor: "#333333", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingBottom: 11 },
    upcomingHeader: { marginTop: 24 },
    sectionTitle: { color: "#E6E6E6", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
    count: { color: "#777777", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
    assignmentList: { paddingTop: 4 },
    assignmentRow: { alignItems: "center", backgroundColor: "#111111", borderColor: "#242424", borderRadius: 11, borderWidth: 1, flexDirection: "row", marginTop: 7, minHeight: 76, paddingHorizontal: 11, paddingVertical: 11 },
    assignmentAccent: { borderRadius: 2, height: 38, marginRight: 11, width: 3 },
    assignmentDate: { alignItems: "center", marginRight: 12, width: 33 },
    assignmentDay: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
    assignmentMonth: { color: "#777777", fontSize: 8, fontWeight: "800", marginTop: 1 },
    assignmentInfo: { flex: 1, minWidth: 0 },
    assignmentName: { color: "#F5F5F5", fontSize: 13, fontWeight: "700" },
    assignmentDue: { color: "#8A8A8A", fontSize: 9, fontWeight: "700", marginTop: 4 },
    assignmentStatus: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6, marginTop: 4 },
    assignmentDescription: { color: "#B7B7B7", fontSize: 13, lineHeight: 20, marginBottom: 20, marginTop: 14 },
    loading: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 22 },
    loadingText: { color: "#999999", fontSize: 12 },
    emptyCopy: { color: "#858585", fontSize: 12, lineHeight: 19, paddingVertical: 15 },
    error: { color: "#FF7777", fontSize: 12, marginBottom: 12 },
    chatError: { color: "#FF7777", fontSize: 12, marginTop: 8 },
    emptyScreen: { alignItems: "center", backgroundColor: "#0A0A0A", flex: 1, justifyContent: "center", padding: 30 },
    emptyTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 8 },
    modalBackdrop: { backgroundColor: "rgba(0,0,0,0.78)", flex: 1, justifyContent: "flex-end" },
    notificationSheet: { backgroundColor: "#141414", borderColor: "#333333", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, maxHeight: "78%", minHeight: 230, padding: 20, paddingBottom: 30 },
    detailSheet: { backgroundColor: "#141414", borderColor: "#333333", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, maxHeight: "90%", minHeight: "55%", padding: 20, paddingBottom: 26 },
    modalHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
    modalKicker: { color: "#858585", fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 },
    modalTitle: { color: "#FFFFFF", flexShrink: 1, fontSize: 20, fontWeight: "800" },
    notificationRow: { alignItems: "center", borderBottomColor: "#292929", borderBottomWidth: 1, flexDirection: "row", gap: 11, paddingVertical: 13 },
    notificationIcon: { alignItems: "center", backgroundColor: "#281719", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
    notificationInfo: { flex: 1, minWidth: 0 },
    notificationTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    notificationDescription: { color: "#999999", fontSize: 11, lineHeight: 15, marginTop: 3 },
    notificationDue: { color: "#ED1C24", fontSize: 9, fontWeight: "800", letterSpacing: 0.6, marginTop: 5 },
    detailHeading: { flex: 1, paddingRight: 16 },
    detailContent: { paddingBottom: 8 },
    detailMetaRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
    detailMeta: { color: "#8A8A8A", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
    detailStatus: { borderRadius: 999, fontSize: 9, fontWeight: "900", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5 },
    statusPrompt: { color: "#999999", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 7 },
    assignmentStatusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 15 },
    assignmentStatusOption: { alignItems: "center", borderColor: "transparent", borderRadius: 999, borderWidth: 2, justifyContent: "center", minHeight: 30, paddingHorizontal: 9 },
    selectedAssignmentStatus: { borderColor: "#FFFFFF" },
    assignmentStatusText: { fontSize: 9, fontWeight: "900" },
    chatHeader: { alignItems: "center", borderBottomColor: "#333333", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10 },
    chatBubble: { alignSelf: "flex-start", backgroundColor: "#202020", borderColor: "#333333", borderRadius: 10, borderWidth: 1, marginBottom: 8, maxWidth: "88%", padding: 11 },
    userBubble: { alignSelf: "flex-end", backgroundColor: "#302020", borderColor: "#633434" },
    notificationBubble: { alignSelf: "center", backgroundColor: "#242020", borderColor: "#4A3030", borderWidth: 1, maxWidth: "100%" },
    chatSpeaker: { color: "#909090", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 4 },
    chatText: { color: "#E5E5E5", fontSize: 13, lineHeight: 18 },
    chatInput: { backgroundColor: "#1A1A1A", borderColor: "#383838", borderRadius: 9, borderWidth: 1, color: "#FFFFFF", height: 75, marginTop: 12, padding: 12, textAlignVertical: "top" },
    sendButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, flexDirection: "row", height: 48, justifyContent: "space-between", marginTop: 10, paddingHorizontal: 16 },
    sendButtonText: { color: "#0A0A0A", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
    disabledButton: { opacity: 0.55 },
    upcomingLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, paddingVertical: 13 },
    upcomingLinkText: { color: "#ED1C24", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
    nextUpCard: { backgroundColor: "#151515", borderColor: "#ED1C24", borderRadius: 14, borderWidth: 1, marginBottom: 20, padding: 16 },
    nextUpLabel: { color: "#ED1C24", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
    nextUpName: { color: "#FFFFFF", fontSize: 19, fontWeight: "700", lineHeight: 25, marginTop: 8 },
    nextUpDue: { color: "#C4C4C4", fontSize: 11, fontWeight: "700", marginTop: 6 },
    nextUpDescription: { color: "#A5A5A5", fontSize: 12, lineHeight: 18, marginTop: 9 },
    nextUpActions: { flexDirection: "row", gap: 8, marginTop: 15 },
    completeButton: { alignItems: "center", backgroundColor: "#276B48", borderRadius: 999, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 42, paddingHorizontal: 10 },
    completeButtonText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
    detailsButton: { alignItems: "center", borderColor: "#444444", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 15 },
    detailsButtonText: { color: "#E5E5E5", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
    inboxCard: { alignItems: "center", backgroundColor: "#141414", borderColor: "#2B2B2B", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 11, marginBottom: 22, padding: 13 },
    inboxIcon: { alignItems: "center", backgroundColor: "#281719", borderRadius: 20, height: 39, justifyContent: "center", width: 39 },
    inboxCopy: { flex: 1 }, inboxTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" }, inboxSub: { color: "#858585", fontSize: 10, marginTop: 4 },
    messageRow: { alignItems: "center", backgroundColor: "#111111", borderColor: "#292929", borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 7, padding: 12 },
    messageIcon: { alignItems: "center", backgroundColor: "#222222", borderRadius: 20, height: 38, justifyContent: "center", width: 38 },
    messageCopy: { flex: 1, minWidth: 0 }, messageTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" }, messagePreview: { color: "#858585", fontSize: 10, lineHeight: 15, marginTop: 4 },
    bottomNav: { alignItems: "center", alignSelf: "center", backgroundColor: "#101010", borderBottomColor: "#242424", borderBottomWidth: 1, borderColor: "#242424", borderLeftWidth: 1, borderRightWidth: 1, borderTopColor: "#2B2B2B", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-around", maxWidth: 480, paddingBottom: 8, paddingTop: 9, width: "100%" },
    navItem: { alignItems: "center", flex: 1, gap: 4, justifyContent: "center", minHeight: 48 },
    navIconWrap: { alignItems: "center", height: 20, justifyContent: "center", position: "relative", width: 25 },
    navBadge: { backgroundColor: "#ED1C24", borderColor: "#101010", borderRadius: 4, borderWidth: 1, height: 8, position: "absolute", right: 0, top: -2, width: 8 },
    navLabel: { color: "#777777", fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
    navLabelActive: { color: "#FFFFFF" },
  }), StyleSheet.create({
    screen: { backgroundColor: "#F4F4F4" },
    content: { backgroundColor: "#F4F4F4", borderColor: "#E5E5E5" },
    header: { borderBottomColor: "#E2E2E2" },
    brandName: { color: "#111111" }, brandSub: { color: "#777777" },
    dealerIdentity: { backgroundColor: "#FFFFFF", borderColor: "#E1E1E1" },
    dealerAvatar: { backgroundColor: "#F6E5E5" }, dealerAvatarText: { color: "#B53D36" }, dealerSubline: { color: "#777777" },
    bellButton: { backgroundColor: "#FFFFFF", borderColor: "#DDDDDD" },
    notificationBadge: { borderColor: "#FFFFFF" },
    kicker: { color: "#777777" }, heading: { color: "#111111" }, headingYear: { color: "#888888" }, greeting: { color: "#222222" },
    monthButton: { backgroundColor: "#FFFFFF", borderColor: "#DDDDDD" }, todayButton: { borderColor: "#D8D8D8" }, todayButtonText: { color: "#555555" },
    calendar: { backgroundColor: "#FFFFFF", borderColor: "#E0E0E0" }, weekday: { color: "#888888" },
    dateText: { color: "#333333" }, mutedDate: { color: "#B9B9B9" },
    sectionHeader: { borderBottomColor: "#DDDDDD" }, sectionTitle: { color: "#222222" }, count: { color: "#888888" },
    assignmentRow: { backgroundColor: "#FFFFFF", borderColor: "#E4E4E4" }, assignmentDay: { color: "#161616" }, assignmentMonth: { color: "#888888" },
    assignmentName: { color: "#181818" }, assignmentDue: { color: "#777777" }, assignmentDescription: { color: "#555555" },
    loadingText: { color: "#777777" }, emptyCopy: { color: "#777777" }, error: { color: "#B53A33" }, chatError: { color: "#B53A33" },
    emptyScreen: { backgroundColor: "#F4F4F4" }, emptyTitle: { color: "#111111" },
    modalBackdrop: { backgroundColor: "rgba(17,17,17,0.42)" },
    notificationSheet: { backgroundColor: "#FFFFFF", borderColor: "#E1E1E1" }, detailSheet: { backgroundColor: "#FFFFFF", borderColor: "#E1E1E1" },
    modalKicker: { color: "#777777" }, modalTitle: { color: "#111111" }, notificationRow: { borderBottomColor: "#EEEEEE" },
    notificationIcon: { backgroundColor: "#FFF0EE" }, notificationTitle: { color: "#111111" }, notificationDescription: { color: "#777777" },
    detailMeta: { color: "#777777" }, selectedAssignmentStatus: { borderColor: "#222222" },
    chatHeader: { borderBottomColor: "#DDDDDD" }, chatBubble: { backgroundColor: "#F1F1F1", borderColor: "#E4E4E4" },
    userBubble: { backgroundColor: "#F1D9D6", borderColor: "#E9C5C2" }, notificationBubble: { backgroundColor: "#FFF0EE", borderColor: "#F0C2BE" },
    chatSpeaker: { color: "#777777" }, chatText: { color: "#222222" }, chatInput: { backgroundColor: "#FFFFFF", borderColor: "#D6D6D6", color: "#111111" },
    sendButton: { backgroundColor: "#D6453D" }, sendButtonText: { color: "#FFFFFF" },
    upcomingLinkText: { color: "#D6453D" },
    nextUpCard: { backgroundColor: "#FFFFFF", borderColor: "#D6453D" }, nextUpName: { color: "#171717" }, nextUpDue: { color: "#555555" }, nextUpDescription: { color: "#666666" },
    completeButton: { backgroundColor: "#287A4C" }, detailsButton: { borderColor: "#D6D6D6" }, detailsButtonText: { color: "#333333" },
    inboxCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E1E1" }, inboxIcon: { backgroundColor: "#FFF0EE" }, inboxTitle: { color: "#222222" }, inboxSub: { color: "#777777" },
    messageRow: { backgroundColor: "#FFFFFF", borderColor: "#E1E1E1" }, messageIcon: { backgroundColor: "#F0F0F0" }, messageTitle: { color: "#222222" }, messagePreview: { color: "#777777" },
    bottomNav: { backgroundColor: "#FFFFFF", borderBottomColor: "#E0E0E0", borderColor: "#E0E0E0", borderTopColor: "#DDDDDD" },
    navBadge: { borderColor: "#FFFFFF" }, navLabelActive: { color: "#222222" },
  }));