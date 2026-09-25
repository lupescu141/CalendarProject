import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { acknowledgeAssignmentNotification, createAssignment, listAssignments, listUsers, notifyAssignment, updateAssignmentDetails, updateAssignmentFeedback, updateAssignmentStatus, type AssignmentRecord, type UserRecord } from "../../lib/adminApi";

const today = new Date();
const defaultDueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
  .toISOString()
  .slice(0, 10);
const statusLabels = ["TO DO", "IN PROGRESS", "OVERDUE", "DONE"] as const;
const statuses = [0, 1, 2, 3] as const;
const statusColors = ["#E8E8E8", "#777777", "#D6453D", "#3D8B5C"];
const statusTextColors = ["#333333", "#FFFFFF", "#FFFFFF", "#FFFFFF"];

type FeedbackMessage = { speaker: string; text: string };
const notificationWaiting = "Notification waiting for response";
const notificationReceived = "Notification received";

function parseFeedback(feedback: string | null): FeedbackMessage[] {
  if (!feedback) return [];

  const messages: FeedbackMessage[] = [];
  const messagePattern = /<#([^>]+)#>([\s\S]*?)(?:<\(#\1#\)>|<#\1#>)/gi;
  let match: RegExpExecArray | null;
  while ((match = messagePattern.exec(feedback)) !== null) {
    if (match[2].trim()) messages.push({ speaker: match[1], text: match[2].trim() });
  }

  return messages.length ? messages : [{ speaker: "FEEDBACK", text: feedback.trim() }];
}

function formatCreatedDate(value: string) {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function Admin() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [assignmentName, setAssignmentName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [expandedUser, setExpandedUser] = useState<UserRecord | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRecord | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [assignmentDescriptionDraft, setAssignmentDescriptionDraft] = useState("");
  const [assignmentDueDateDraft, setAssignmentDueDateDraft] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    listUsers()
      .then((records) => { if (mounted) setUsers(records.filter((user) => !user.admin)); })
      .catch(() => { if (mounted) { setLoadError(true); setMessage("Could not connect to the admin API. Start it with npm run api."); } })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  function openAssignment(user: UserRecord) {
    setSelectedUser(user);
    setAssignmentName("");
    setDescription("");
    setDueDate(defaultDueDate);
    setMessage("");
  }

  async function toggleUserAssignments(user: UserRecord) {
    if (expandedUser?.id === user.id) {
      setExpandedUser(null);
      return;
    }

    setExpandedUser(user);
    setAssignments([]);
    setAssignmentsLoading(true);
    try {
      setAssignments(await listAssignments(user.facility));
    } catch {
      setMessage("Could not load assignments for this facility.");
    } finally {
      setAssignmentsLoading(false);
    }
  }

  async function changeStatus(assignment: AssignmentRecord, status: 0 | 1 | 2 | 3) {
    setMessage("");
    try {
      const updated = await updateAssignmentStatus(assignment.id, status);
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setMessage(`Status update failed: ${error instanceof Error ? error.message : "check the admin API"}`);
    }
  }

  function openAssignmentDetails(assignment: AssignmentRecord) {
    setSelectedAssignment(assignment);
    setFeedbackDraft("");
    setEditingAssignment(false);
    setAssignmentDescriptionDraft(assignment.description);
    setAssignmentDueDateDraft(assignment.end_date.slice(0, 10));
    setMessage("");
    if (assignment.important === 2) {
      acknowledgeAssignmentNotification(assignment.id)
        .then((updated) => {
          setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
          setSelectedAssignment(updated);
        })
        .catch(() => setMessage("Notification could not be acknowledged."));
    }
  }

  async function saveAssignmentDetails() {
    if (!selectedAssignment || !assignmentDescriptionDraft.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(assignmentDueDateDraft)) {
      setMessage("Add a description and valid due date.");
      return;
    }
    setAssignmentSaving(true);
    setMessage("");
    try {
      const updated = await updateAssignmentDetails(selectedAssignment.id, assignmentDescriptionDraft.trim(), `${assignmentDueDateDraft} 23:59:59`);
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedAssignment(updated);
      setEditingAssignment(false);
    } catch {
      setMessage("Assignment could not be updated. Check the database connection.");
    } finally {
      setAssignmentSaving(false);
    }
  }

  async function sendNotification() {
    if (!selectedAssignment || selectedAssignment.important === 1) return;
    setNotificationSaving(true);
    setMessage("");
    try {
      const updated = await notifyAssignment(selectedAssignment.id);
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedAssignment(updated);
    } catch {
      setMessage("Notification could not be sent. Check the database connection.");
    } finally {
      setNotificationSaving(false);
    }
  }

  async function saveFeedback() {
    if (!selectedAssignment || !feedbackDraft.trim()) return;

    setFeedbackSaving(true);
    setMessage("");
    const nextFeedback = `${selectedAssignment.feedback ? `${selectedAssignment.feedback.trim()}\n` : ""}<#ADMIN#>${feedbackDraft.trim()}<(#ADMIN#)>`;
    try {
      const updated = await updateAssignmentFeedback(selectedAssignment.id, nextFeedback);
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedAssignment(updated);
      setFeedbackDraft("");
    } catch {
      setMessage("Feedback could not be saved. Check the database connection.");
    } finally {
      setFeedbackSaving(false);
    }
  }

  async function saveAssignment() {
    if (!selectedUser || !assignmentName.trim() || !description.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setMessage("Add a name, description, and valid due date.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await createAssignment({
        description: description.trim(),
        end_date: `${dueDate} 23:59:59`,
        facility: selectedUser.facility,
        name: assignmentName.trim(),
      });
      setSelectedUser(null);
      setMessage(`Assignment sent to ${selectedUser.firstname}.`);
    } catch {
      setMessage("Assignment could not be sent. Check the database connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111111" />
        </Pressable>
        <Text style={styles.brandName}><Text style={styles.brandFirst}>first</Text><Text style={styles.brandStop}>stop</Text></Text>
        <View style={styles.adminMark}><Ionicons name="shield-checkmark-outline" size={19} color="#FFFFFF" /></View>
      </View>
      
      <Text style={styles.kicker}>ADMINISTRATION</Text>
      <Text style={styles.heading}>Your people.</Text>
      <Text style={styles.intro}>Choose someone from your team and send them a clear next step.</Text>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>TEAM MEMBERS</Text><Text style={styles.count}>{users.length} USERS</Text></View>
      {loading && <Text style={styles.emptyText}>Loading users...</Text>}
      {!loading && !loadError && users.length === 0 && <Text style={styles.emptyText}>No non-admin users found.</Text>}
      <View style={styles.userList}>
        {users.map((user) => (
          <View key={user.id}>
            <View style={styles.userRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{user.firstname.charAt(0)}{user.surname.charAt(0)}</Text></View>
            <Pressable accessibilityLabel={`Show assignments for ${user.firstname} ${user.surname}`} accessibilityRole="button" onPress={() => toggleUserAssignments(user)} style={styles.userDetails}><Text style={styles.userName}>{user.firstname} {user.surname}</Text><Text style={styles.userMeta}>{user.email}  ·  {user.facility}</Text></Pressable>
            <Pressable accessibilityLabel={`Assign work to ${user.firstname} ${user.surname}`} accessibilityRole="button" onPress={() => openAssignment(user)} style={styles.assignButton}>
              <Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.assignText}>ASSIGN</Text>
            </Pressable>
            </View>
            {expandedUser?.id === user.id && <View style={styles.assignmentPanel}>
              <View style={styles.assignmentPanelHeader}><Text style={styles.assignmentPanelTitle}>FACILITY ASSIGNMENTS</Text><Text style={styles.assignmentCount}>{assignments.length}</Text></View>
              {assignmentsLoading && <Text style={styles.assignmentEmpty}>Loading assignments...</Text>}
              {!assignmentsLoading && assignments.length === 0 && <Text style={styles.assignmentEmpty}>No assignments for this facility.</Text>}
              {!assignmentsLoading && assignments.map((assignment) => <View key={assignment.id} style={styles.assignmentRow}>
                <View style={styles.assignmentTopRow}><View style={styles.assignmentDetails}><Text style={styles.assignmentName}>{assignment.name}</Text><Text style={styles.assignmentDescription}>{assignment.description}</Text><Text style={styles.assignmentDue}>DUE {assignment.end_date}</Text></View><Pressable accessibilityLabel={`Expand ${assignment.name}`} accessibilityRole="button" hitSlop={8} onPress={() => openAssignmentDetails(assignment)} style={styles.expandButton}><Ionicons name="open-outline" size={18} color="#D6453D" /></Pressable></View>
                <View style={styles.statusOptions}>{statuses.map((status) => <Pressable accessibilityLabel={`Set ${assignment.name} to ${statusLabels[status]}`} accessibilityRole="button" key={status} onPress={() => changeStatus(assignment, status)} style={[styles.statusButton, { backgroundColor: statusColors[status] }, assignment.status === status && styles.selectedStatus]}><Text style={[styles.statusText, { color: statusTextColors[status] }]}>{statusLabels[status]}</Text></Pressable>)}</View>
              </View>)}
            </View>}
          </View>
        ))}
      </View>
      {!!message && <Text style={styles.message}>{message}</Text>}

      <Modal animationType="slide" transparent visible={selectedUser !== null} onRequestClose={() => setSelectedUser(null)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeader}><View><Text style={styles.modalKicker}>NEW ASSIGNMENT</Text><Text style={styles.modalTitle}>{selectedUser?.firstname} {selectedUser?.surname}</Text></View><Pressable accessibilityLabel="Close assignment form" accessibilityRole="button" onPress={() => setSelectedUser(null)}><Ionicons name="close" size={22} color="#111111" /></Pressable></View>
          <TextInput onChangeText={setAssignmentName} placeholder="Assignment name" placeholderTextColor="#999999" style={styles.input} value={assignmentName} />
          <TextInput multiline onChangeText={setDescription} placeholder="What needs to be done?" placeholderTextColor="#999999" style={[styles.input, styles.descriptionInput]} value={description} />
          <Text style={styles.inputLabel}>DUE DATE</Text>
          <TextInput onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor="#999999" style={styles.input} value={dueDate} />
          <Pressable accessibilityRole="button" disabled={saving} onPress={saveAssignment} style={[styles.saveButton, saving && styles.disabledButton]}><Text style={styles.saveText}>{saving ? "SENDING..." : "SEND ASSIGNMENT"}</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
        </View></View>
      </Modal>

      <Modal animationType="slide" transparent visible={selectedAssignment !== null} onRequestClose={() => setSelectedAssignment(null)}>
        <View style={styles.modalBackdrop}><View style={styles.feedbackCard}>
          {selectedAssignment && <>
            <View style={styles.modalHeader}><View style={styles.feedbackHeading}><Text style={styles.modalKicker}>ASSIGNMENT DETAILS</Text><Text style={styles.modalTitle}>{selectedAssignment.name}</Text></View><View style={styles.detailHeaderActions}><Pressable accessibilityLabel="Edit assignment" accessibilityRole="button" onPress={() => setEditingAssignment(true)} style={styles.editButton}><Ionicons name="create-outline" size={16} color="#111111" /><Text style={styles.editButtonText}>EDIT</Text></Pressable><Pressable accessibilityLabel="Close assignment details" accessibilityRole="button" onPress={() => setSelectedAssignment(null)}><Ionicons name="close" size={22} color="#111111" /></Pressable></View></View>
            <ScrollView contentContainerStyle={styles.feedbackContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.feedbackLabel}>CREATED {formatCreatedDate(selectedAssignment.date_created)}</Text>
              {editingAssignment ? <><TextInput multiline onChangeText={setAssignmentDescriptionDraft} placeholder="What needs to be done?" placeholderTextColor="#999999" style={[styles.input, styles.descriptionInput]} value={assignmentDescriptionDraft} /><Text style={styles.inputLabel}>DUE DATE</Text><TextInput onChangeText={setAssignmentDueDateDraft} placeholder="YYYY-MM-DD" placeholderTextColor="#999999" style={styles.input} value={assignmentDueDateDraft} /><Pressable accessibilityRole="button" disabled={assignmentSaving} onPress={saveAssignmentDetails} style={[styles.saveButton, assignmentSaving && styles.disabledButton]}><Text style={styles.saveText}>{assignmentSaving ? "SAVING..." : "SAVE CHANGES"}</Text><Ionicons name="checkmark" size={18} color="#FFFFFF" /></Pressable></> : <Text style={styles.feedbackDescription}>{selectedAssignment.description}</Text>}
              <Pressable accessibilityRole="button" accessibilityLabel="Send notification" disabled={notificationSaving || selectedAssignment.important === 1} onPress={sendNotification} style={[styles.notifyButton, (notificationSaving || selectedAssignment.important === 1) && styles.disabledButton]}><Ionicons name="notifications-outline" size={17} color="#FFFFFF" /><Text style={styles.saveText}>{selectedAssignment.important === 1 ? "NOTIFICATION SENT" : notificationSaving ? "SENDING..." : "NOTIFY"}</Text></Pressable>
              <Text style={styles.feedbackSectionTitle}>FEEDBACK</Text>
              {parseFeedback(selectedAssignment.feedback).map((entry, index) => { const isNotification = entry.speaker.toUpperCase() === "NOTIFICATION"; return <View key={`${entry.speaker}-${index}`} style={[styles.feedbackMessage, entry.speaker.toUpperCase() === "ADMIN" && styles.adminMessage, isNotification && styles.notificationMessage]}><Text style={styles.feedbackSpeaker}>{entry.speaker.toUpperCase()}</Text><Text style={styles.feedbackMessageText}>{entry.text === notificationWaiting ? notificationWaiting : entry.text === notificationReceived ? notificationReceived : entry.text}</Text></View>; })}
              {!selectedAssignment.feedback && <Text style={styles.feedbackEmpty}>No feedback yet. Start the conversation below.</Text>}
              <TextInput multiline onChangeText={setFeedbackDraft} placeholder="Write feedback as admin..." placeholderTextColor="#999999" style={[styles.input, styles.feedbackInput]} value={feedbackDraft} />
              <Pressable accessibilityRole="button" disabled={feedbackSaving || !feedbackDraft.trim()} onPress={saveFeedback} style={[styles.saveButton, (feedbackSaving || !feedbackDraft.trim()) && styles.disabledButton]}><Text style={styles.saveText}>{feedbackSaving ? "SAVING..." : "ADD FEEDBACK"}</Text><Ionicons name="send" size={17} color="#FFFFFF" /></Pressable>
            </ScrollView>
          </>}
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: "#FFFFFF", flexGrow: 1, paddingBottom: 40, paddingHorizontal: 24, paddingTop: 24 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 53 },
  brandName: { fontSize: 18, fontWeight: "800", letterSpacing: 0.2 }, brandFirst: { color: "#111111" }, brandStop: { color: "#D6453D" },
  adminMark: { alignItems: "center", backgroundColor: "#111111", borderRadius: 5, height: 38, justifyContent: "center", width: 38 },
  kicker: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 }, heading: { color: "#111111", fontSize: 36, fontWeight: "900", letterSpacing: -1, marginBottom: 10 },
  intro: { color: "#666666", fontSize: 15, lineHeight: 22, marginBottom: 42, maxWidth: 300 },
  sectionHeader: { alignItems: "center", borderBottomColor: "#DDDDDD", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingBottom: 12 }, sectionTitle: { color: "#111111", fontSize: 11, fontWeight: "900", letterSpacing: 1.4 }, count: { color: "#999999", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  userList: { gap: 12, paddingTop: 13 }, userRow: { alignItems: "center", borderBottomColor: "#EEEEEE", borderBottomWidth: 1, flexDirection: "row", paddingBottom: 13 }, avatar: { alignItems: "center", backgroundColor: "#F1D9D6", borderRadius: 22, height: 44, justifyContent: "center", marginRight: 12, width: 44 }, avatarText: { color: "#B53D36", fontSize: 13, fontWeight: "900" },
  userDetails: { flex: 1, minWidth: 0 }, userName: { color: "#111111", fontSize: 15, fontWeight: "800" }, userMeta: { color: "#888888", fontSize: 11, marginTop: 4 }, assignButton: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 4, flexDirection: "row", gap: 3, height: 34, justifyContent: "center", marginLeft: 8, paddingHorizontal: 9 }, assignText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  assignmentPanel: { backgroundColor: "#F7F7F7", borderBottomColor: "#DDDDDD", borderBottomWidth: 1, padding: 13 }, assignmentPanelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }, assignmentPanelTitle: { color: "#555555", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }, assignmentCount: { color: "#999999", fontSize: 11, fontWeight: "800" }, assignmentEmpty: { color: "#777777", fontSize: 12, paddingVertical: 8 }, assignmentRow: { backgroundColor: "#FFFFFF", borderColor: "#E4E4E4", borderRadius: 4, borderWidth: 1, marginBottom: 8, padding: 11 }, assignmentTopRow: { flexDirection: "row" }, assignmentDetails: { flex: 1, marginBottom: 10 }, expandButton: { alignItems: "center", borderColor: "#F0C2BE", borderRadius: 4, borderWidth: 1, height: 32, justifyContent: "center", marginLeft: 8, width: 32 }, assignmentName: { color: "#111111", fontSize: 14, fontWeight: "800" }, assignmentDescription: { color: "#666666", fontSize: 12, lineHeight: 17, marginTop: 3 }, assignmentDue: { color: "#999999", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginTop: 7 }, statusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, statusButton: { alignItems: "center", borderRadius: 3, minHeight: 28, justifyContent: "center", paddingHorizontal: 8 }, selectedStatus: { borderColor: "#111111", borderWidth: 2 }, statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  emptyText: { color: "#777777", fontSize: 14, paddingVertical: 22 }, message: { color: "#D6453D", fontSize: 13, marginTop: 20 }, modalBackdrop: { backgroundColor: "rgba(17,17,17,0.4)", flex: 1, justifyContent: "flex-end" }, modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: 24, paddingBottom: 36 }, feedbackCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 10, borderTopRightRadius: 10, maxHeight: "90%", padding: 24, paddingBottom: 32 }, feedbackHeading: { flex: 1, paddingRight: 16 }, feedbackContent: { paddingBottom: 4 }, feedbackLabel: { color: "#999999", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 15 }, feedbackDescription: { color: "#555555", fontSize: 14, lineHeight: 21, marginBottom: 24 }, feedbackSectionTitle: { color: "#111111", fontSize: 10, fontWeight: "900", letterSpacing: 1.3, marginBottom: 10 }, feedbackMessage: { alignSelf: "flex-start", backgroundColor: "#F1F1F1", borderRadius: 6, marginBottom: 8, maxWidth: "86%", padding: 11 }, adminMessage: { alignSelf: "flex-end", backgroundColor: "#F1D9D6" }, feedbackSpeaker: { color: "#777777", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 4 }, feedbackMessageText: { color: "#222222", fontSize: 13, lineHeight: 18 }, feedbackEmpty: { color: "#888888", fontSize: 12, marginBottom: 12 }, feedbackInput: { height: 78, marginTop: 10, paddingTop: 13 },
  modalHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }, detailHeaderActions: { alignItems: "center", flexDirection: "row", gap: 12 }, editButton: { alignItems: "center", flexDirection: "row", gap: 4 }, editButtonText: { color: "#111111", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, modalKicker: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7 }, modalTitle: { color: "#111111", fontSize: 24, fontWeight: "900" }, input: { borderColor: "#D6D6D6", borderRadius: 5, borderWidth: 1, color: "#111111", fontSize: 15, height: 53, marginBottom: 13, paddingHorizontal: 14 }, descriptionInput: { height: 92, paddingTop: 14, textAlignVertical: "top" }, inputLabel: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 }, saveButton: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 5, flexDirection: "row", height: 56, justifyContent: "space-between", marginTop: 11, paddingHorizontal: 18 }, notifyButton: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#D6453D", borderRadius: 5, flexDirection: "row", gap: 7, height: 42, justifyContent: "center", marginBottom: 23, paddingHorizontal: 14 }, notificationMessage: { alignSelf: "center", backgroundColor: "#FFF0EE", borderColor: "#F0C2BE", borderWidth: 1, maxWidth: "100%" }, disabledButton: { opacity: 0.6 }, saveText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
});