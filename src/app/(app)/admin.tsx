import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "../../ctx";
import { SignOutPrompt } from "../../components/sign-out-prompt";
import { AssignmentAttachments } from "../../components/assignment-attachments";
import { acknowledgeAssignmentNotification, createAssignment, listAssignments, listUsers, notifyAssignment, updateAssignmentDetails, updateAssignmentFeedback, updateAssignmentStatus, type AssignmentRecord, type UserRecord } from "../../lib/adminApi";
import { mergeStyleSheets } from "../../lib/mergeStyleSheets";

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
  const { currentUser, signOut } = useSession();
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
  const [signOutPromptOpen, setSignOutPromptOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [assignmentSort, setAssignmentSort] = useState<"due" | "name" | "status">("due");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [directoryLayout, setDirectoryLayout] = useState<"table" | "grid">("table");

  useEffect(() => {
    let mounted = true;
    listUsers()
      .then((records) => { if (mounted) setUsers(records.filter((user) => !user.admin)); })
      .catch(() => { if (mounted) { setLoadError(true); setMessage("Could not connect to the admin API. Start it with npm run api."); } })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (currentUser?.admin) return;
    router.replace("/(app)/calendar");
  }, [currentUser, router]);

  useEffect(() => {
    if (!expandedUser) return;

    let active = true;
    let refreshing = false;
    const refreshAssignments = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const records = await listAssignments(expandedUser.facility);
        if (!active) return;
        setAssignments(records);
        setSelectedAssignment((current) => current
          ? records.find((assignment) => assignment.id === current.id) ?? null
          : null);
      } catch (error) {
        if (active) setMessage(`Could not load assignments: ${error instanceof Error ? error.message : "check the admin API"}`);
      } finally {
        refreshing = false;
        if (active) setAssignmentsLoading(false);
      }
    };

    void refreshAssignments();
    const interval = setInterval(() => void refreshAssignments(), 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [expandedUser, router]);

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
        assigned_to_user_id: selectedUser.id,
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

  const facilities = new Set(users.map((user) => user.facility)).size;
  const filteredUsers = users
    .filter((user) => `${user.firstname} ${user.surname} ${user.email} ${user.facility}`.toLowerCase().includes(userSearch.trim().toLowerCase()))
    .sort((left, right) => `${left.facility} ${left.firstname} ${left.surname}`.localeCompare(`${right.facility} ${right.firstname} ${right.surname}`));
  const visibleAssignments = assignments
    .filter((assignment) => !attentionOnly || assignment.status === 2)
    .sort((left, right) => {
      if (assignmentSort === "name") return left.name.localeCompare(right.name);
      if (assignmentSort === "status") return left.status - right.status || left.end_date.localeCompare(right.end_date);
      return left.end_date.localeCompare(right.end_date);
    });
  const openAssignmentCount = assignments.filter((assignment) => assignment.status !== 3).length;
  const overdueAssignmentCount = assignments.filter((assignment) => assignment.status === 2).length;
  const timelineYear = new Date().getFullYear();
  const timelineMonths = Array.from({ length: 12 }, (_, index) => new Date(timelineYear, index, 1)
    .toLocaleDateString("en-US", { month: "short" }).toUpperCase());

  return (
    currentUser?.admin ?
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brandGroup}>
          <Text style={styles.brandName}><Text style={styles.brandFirst}>First Stop</Text><Text style={styles.brandStop}>  Chain Ops</Text></Text>
          <View style={styles.adminMark}><Ionicons name="shield-checkmark-outline" size={16} color="#D6453D" /><Text style={styles.adminMarkText}>HQ DESKTOP</Text></View>
        </View>
        <Pressable accessibilityLabel="Sign out" accessibilityRole="button" onPress={() => setSignOutPromptOpen(true)} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={17} color="#555555" /><Text style={styles.signOutText}>SIGN OUT</Text>
        </Pressable>
      </View>
      
      <View style={styles.pageIntro}>
        <View>
          <Text style={styles.kicker}>CHAIN OPERATIONS · HEADQUARTERS</Text>
          <Text style={styles.heading}>Operations overview</Text>
          <Text style={styles.intro}>Manage dealership work, track progress, and keep every team moving.</Text>
        </View>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE OVERVIEW</Text></View>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}><Text style={styles.kpiLabel}>TEAM MEMBERS</Text><Text style={styles.kpiValue}>{users.length}</Text><Text style={styles.kpiSub}>across the chain</Text></View>
        <View style={styles.kpiCard}><Text style={styles.kpiLabel}>DEALERSHIPS</Text><Text style={styles.kpiValue}>{facilities}</Text><Text style={styles.kpiSub}>represented locations</Text></View>
        <View style={styles.kpiCard}><Text style={styles.kpiLabel}>OPEN ASSIGNMENTS</Text><Text style={styles.kpiValue}>{expandedUser ? openAssignmentCount : "—"}</Text><Text style={styles.kpiSub}>{expandedUser ? expandedUser.facility : "select a dealership"}</Text></View>
        <View style={[styles.kpiCard, styles.attentionKpi]}><Text style={styles.kpiLabel}>NEEDS ATTENTION</Text><Text style={styles.kpiValue}>{expandedUser ? overdueAssignmentCount : "—"}</Text><Text style={styles.kpiSub}>{expandedUser ? "overdue assignments" : "select a dealership"}</Text></View>
      </View>

      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>DEALERSHIP DIRECTORY</Text><Text style={styles.sectionSub}>Select a team member to review their location’s assignments.</Text></View><Text style={styles.count}>{users.length} USERS · {facilities} LOCATIONS</Text></View>
      <View style={styles.toolbar}>
        <View style={styles.searchBox}><Ionicons name="search-outline" size={18} color="#8A8A8A" /><TextInput accessibilityLabel="Search team members and dealerships" onChangeText={setUserSearch} placeholder="Search people or dealerships" placeholderTextColor="#777777" style={styles.searchInput} value={userSearch} /></View>
        <View style={styles.layoutToggle}><Text style={styles.sortHint}>LAYOUT</Text>{(["table", "grid"] as const).map((layout) => <Pressable accessibilityRole="button" key={layout} onPress={() => setDirectoryLayout(layout)} style={[styles.layoutButton, directoryLayout === layout && styles.layoutButtonActive]}><Text style={[styles.layoutButtonText, directoryLayout === layout && styles.layoutButtonTextActive]}>{layout === "table" ? "A · TABLE" : "B · GRID"}</Text></Pressable>)}</View>
      </View>
      {loading && <Text style={styles.emptyText}>Loading users...</Text>}
      {!loading && !loadError && users.length === 0 && <Text style={styles.emptyText}>No non-admin users found.</Text>}
      {!loading && users.length > 0 && filteredUsers.length === 0 && <Text style={styles.emptyText}>No team members match that search.</Text>}
      <View style={[styles.userList, directoryLayout === "grid" && styles.userGrid]}>
        {filteredUsers.map((user) => (
          <View key={user.id} style={directoryLayout === "grid" ? styles.userGridItem : undefined}>
            <View style={[styles.userRow, expandedUser?.id === user.id && styles.selectedUserRow]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{user.firstname.charAt(0)}{user.surname.charAt(0)}</Text></View>
            <Pressable accessibilityLabel={`Show assignments for ${user.firstname} ${user.surname}`} accessibilityRole="button" onPress={() => toggleUserAssignments(user)} style={styles.userDetails}><Text style={styles.userName}>{user.facility}</Text><Text style={styles.userMeta}>{user.firstname} {user.surname} · {user.email}</Text></Pressable>
            <Pressable accessibilityLabel={`Review assignments for ${user.firstname} ${user.surname}`} accessibilityRole="button" onPress={() => void toggleUserAssignments(user)} style={styles.reviewButton}><Text style={styles.reviewText}>{expandedUser?.id === user.id ? "CLOSE" : "OPEN"}</Text><Ionicons name={expandedUser?.id === user.id ? "chevron-up" : "chevron-forward"} size={16} color="#555555" /></Pressable>
            <Pressable accessibilityLabel={`Assign work to ${user.firstname} ${user.surname}`} accessibilityRole="button" onPress={() => openAssignment(user)} style={styles.assignButton}>
              <Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.assignText}>ASSIGN</Text>
            </Pressable>
            </View>
            {expandedUser?.id === user.id && <View style={styles.assignmentPanel}>
              <View style={styles.assignmentPanelHeader}><View><Text style={styles.assignmentPanelTitle}>ASSIGNMENTS · {user.facility}</Text><Text style={styles.assignmentPanelSub}>{assignments.length} total · {openAssignmentCount} open · {overdueAssignmentCount} overdue</Text></View><Pressable accessibilityRole="button" onPress={() => setAttentionOnly((value) => !value)} style={[styles.filterButton, attentionOnly && styles.filterButtonActive]}><Ionicons name="alert-circle-outline" size={15} color={attentionOnly ? "#FFFFFF" : "#777777"} /><Text style={[styles.filterText, attentionOnly && styles.filterTextActive]}>{attentionOnly ? "ALL TASKS" : "NEEDS ATTENTION"}</Text></Pressable></View>
              <View style={styles.assignmentToolbar}><Text style={styles.assignmentToolbarLabel}>SORT TASKS</Text>{(["due", "name", "status"] as const).map((sort) => <Pressable accessibilityRole="button" key={sort} onPress={() => setAssignmentSort(sort)} style={[styles.sortButton, assignmentSort === sort && styles.sortButtonActive]}><Text style={[styles.sortButtonText, assignmentSort === sort && styles.sortButtonTextActive]}>{sort === "due" ? "DUE DATE" : sort === "name" ? "NAME" : "STATUS"}</Text></Pressable>)}</View>
              {assignmentsLoading && <Text style={styles.assignmentEmpty}>Loading assignments...</Text>}
              {!assignmentsLoading && assignments.length === 0 && <Text style={styles.assignmentEmpty}>No assignments for this facility yet. Assign the first task to get started.</Text>}
              {!assignmentsLoading && assignments.length > 0 && visibleAssignments.length === 0 && <Text style={styles.assignmentEmpty}>No overdue assignments for this location.</Text>}
              {!assignmentsLoading && directoryLayout === "grid" && visibleAssignments.length > 0 && <View style={styles.timelineCard}>
                <View style={styles.timelineHeading}><View><Text style={styles.timelineTitle}>ASSIGNMENT TIMELINE</Text><Text style={styles.timelineSubtitle}>Due dates and progress · {timelineYear}</Text></View><View style={styles.timelineLegend}>{statuses.map((status) => <View key={status} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: statusColors[status] }]} /><Text style={styles.legendLabel}>{statusLabels[status]}</Text></View>)}</View></View>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View style={styles.timeline}>
                    <View style={styles.timelineHeaderRow}><Text style={styles.timelineTaskHeader}>ASSIGNMENT</Text><View style={styles.timelineMonthHeader}>{timelineMonths.map((month, index) => <Text key={`${month}-${index}`} style={styles.timelineMonth}>{month}</Text>)}</View></View>
                    {visibleAssignments.map((assignment) => {
                      const dueDate = new Date(`${assignment.end_date.slice(0, 10)}T12:00:00`);
                      const createdDate = new Date(assignment.date_created.replace(" ", "T"));
                      const dueMonth = dueDate.getFullYear() === timelineYear ? dueDate.getMonth() : -1;
                      const startMonth = Number.isNaN(createdDate.getTime()) || createdDate.getFullYear() < timelineYear
                        ? 0
                        : createdDate.getFullYear() > timelineYear
                          ? dueMonth
                          : createdDate.getMonth();
                      const rangeStart = dueMonth < 0 ? -1 : Math.min(startMonth, dueMonth);
                      return <View key={assignment.id} style={styles.timelineRow}>
                        <Pressable accessibilityLabel={`Open assignment ${assignment.name}`} accessibilityRole="button" onPress={() => openAssignmentDetails(assignment)} style={styles.timelineTask}>
                          <Text numberOfLines={1} style={styles.timelineTaskName}>{assignment.name}</Text>
                          <Text style={styles.timelineTaskDue}>DUE {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
                        </Pressable>
                        <View style={styles.timelineMonths}>{timelineMonths.map((month, index) => {
                          const inRange = rangeStart >= 0 && index >= rangeStart && index <= dueMonth;
                          return <View key={`${month}-${index}`} style={styles.timelineMonthCell}>
                            {inRange && <Pressable accessibilityLabel={`${assignment.name}, ${statusLabels[assignment.status]}, ${month}`} accessibilityRole="button" onPress={() => openAssignmentDetails(assignment)} style={[styles.timelineBar, { backgroundColor: statusColors[assignment.status] ?? statusColors[0] }, index === rangeStart && styles.timelineBarStart, index === dueMonth && styles.timelineBarEnd]}>
                              {index === rangeStart && <View style={styles.timelineBarMarker} />}
                            </Pressable>}
                          </View>;
                        })}</View>
                      </View>;
                    })}
                  </View>
                </ScrollView>
                <Text style={styles.timelineHint}>Select a task or timeline bar to view details and update its status.</Text>
              </View>}
              {!assignmentsLoading && directoryLayout === "table" && visibleAssignments.map((assignment) => <View key={assignment.id} style={styles.assignmentRow}>
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
          <View style={styles.modalHeader}><View><Text style={styles.modalKicker}>NEW ASSIGNMENT</Text><Text style={styles.modalTitle}>{selectedUser?.firstname} {selectedUser?.surname}</Text></View><Pressable accessibilityLabel="Close assignment form" accessibilityRole="button" onPress={() => setSelectedUser(null)}><Ionicons name="close" size={22} color="#444444" /></Pressable></View>
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
            <View style={styles.modalHeader}><View style={styles.feedbackHeading}><Text style={styles.modalKicker}>ASSIGNMENT DETAILS</Text><Text style={styles.modalTitle}>{selectedAssignment.name}</Text></View><View style={styles.detailHeaderActions}><Pressable accessibilityLabel="Edit assignment" accessibilityRole="button" onPress={() => setEditingAssignment(true)} style={styles.editButton}><Ionicons name="create-outline" size={16} color="#444444" /><Text style={styles.editButtonText}>EDIT</Text></Pressable><Pressable accessibilityLabel="Close assignment details" accessibilityRole="button" onPress={() => setSelectedAssignment(null)}><Ionicons name="close" size={22} color="#444444" /></Pressable></View></View>
            <ScrollView contentContainerStyle={styles.feedbackContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.feedbackLabel}>CREATED {formatCreatedDate(selectedAssignment.date_created)}</Text>
              {editingAssignment ? <><TextInput multiline onChangeText={setAssignmentDescriptionDraft} placeholder="What needs to be done?" placeholderTextColor="#999999" style={[styles.input, styles.descriptionInput]} value={assignmentDescriptionDraft} /><Text style={styles.inputLabel}>DUE DATE</Text><TextInput onChangeText={setAssignmentDueDateDraft} placeholder="YYYY-MM-DD" placeholderTextColor="#999999" style={styles.input} value={assignmentDueDateDraft} /><Pressable accessibilityRole="button" disabled={assignmentSaving} onPress={saveAssignmentDetails} style={[styles.saveButton, assignmentSaving && styles.disabledButton]}><Text style={styles.saveText}>{assignmentSaving ? "SAVING..." : "SAVE CHANGES"}</Text><Ionicons name="checkmark" size={18} color="#FFFFFF" /></Pressable></> : <Text style={styles.feedbackDescription}>{selectedAssignment.description}</Text>}
              <Pressable accessibilityRole="button" accessibilityLabel="Send notification" disabled={notificationSaving || selectedAssignment.important === 1} onPress={sendNotification} style={[styles.notifyButton, (notificationSaving || selectedAssignment.important === 1) && styles.disabledButton]}><Ionicons name="notifications-outline" size={17} color="#FFFFFF" /><Text style={styles.saveText}>{selectedAssignment.important === 1 ? "NOTIFICATION SENT" : notificationSaving ? "SENDING..." : "NOTIFY"}</Text></Pressable>
              <Text style={styles.feedbackSectionTitle}>FEEDBACK</Text>
              {parseFeedback(selectedAssignment.feedback).map((entry, index) => { const isNotification = entry.speaker.toUpperCase() === "NOTIFICATION"; return <View key={`${entry.speaker}-${index}`} style={[styles.feedbackMessage, entry.speaker.toUpperCase() === "ADMIN" && styles.adminMessage, isNotification && styles.notificationMessage]}><Text style={styles.feedbackSpeaker}>{entry.speaker.toUpperCase()}</Text><Text style={styles.feedbackMessageText}>{entry.text === notificationWaiting ? notificationWaiting : entry.text === notificationReceived ? notificationReceived : entry.text}</Text></View>; })}
              {!selectedAssignment.feedback && <Text style={styles.feedbackEmpty}>No feedback yet. Start the conversation below.</Text>}
              <AssignmentAttachments assignmentId={selectedAssignment.id} uploadedBy="ADMIN" />
              <TextInput multiline onChangeText={setFeedbackDraft} placeholder="Write feedback as admin..." placeholderTextColor="#999999" style={[styles.input, styles.feedbackInput]} value={feedbackDraft} />
              <Pressable accessibilityRole="button" disabled={feedbackSaving || !feedbackDraft.trim()} onPress={saveFeedback} style={[styles.saveButton, (feedbackSaving || !feedbackDraft.trim()) && styles.disabledButton]}><Text style={styles.saveText}>{feedbackSaving ? "SAVING..." : "ADD FEEDBACK"}</Text><Ionicons name="send" size={17} color="#FFFFFF" /></Pressable>
            </ScrollView>
          </>}
        </View></View>
      </Modal>

      <SignOutPrompt
        visible={signOutPromptOpen}
        onCancel={() => setSignOutPromptOpen(false)}
        onConfirm={() => { signOut(); router.replace("/sign-in"); }}
      />
    </ScrollView>
    : null
  );
}

const styles = mergeStyleSheets(StyleSheet.create({
  content: { backgroundColor: "#0A0A0A", flexGrow: 1, paddingBottom: 48, paddingHorizontal: 32, paddingTop: 18 },
  header: { alignItems: "center", borderBottomColor: "#2A2A2A", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 30, paddingBottom: 17 },
  brandGroup: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 18 },
  brandName: { fontSize: 19, fontWeight: "800", letterSpacing: 0.2 }, brandFirst: { color: "#FFFFFF" }, brandStop: { color: "#9C9C9C", fontSize: 13, fontWeight: "500", letterSpacing: 2 },
  adminMark: { alignItems: "center", backgroundColor: "#1A1A1A", borderColor: "#333333", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 8 }, adminMarkText: { color: "#C4C4C4", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  signOutButton: { alignItems: "center", borderColor: "#333333", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 13, paddingVertical: 9 }, signOutText: { color: "#C4C4C4", fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  pageIntro: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 23 },
  kicker: { color: "#9C9C9C", fontSize: 10, fontWeight: "800", letterSpacing: 1.8, marginBottom: 9 }, heading: { color: "#FFFFFF", fontSize: 32, fontWeight: "700", letterSpacing: -0.6, marginBottom: 7 },
  intro: { color: "#9C9C9C", fontSize: 14, lineHeight: 21, marginBottom: 0, maxWidth: 520 },
  liveBadge: { alignItems: "center", backgroundColor: "#141414", borderColor: "#2A2A2A", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, marginBottom: 3, paddingHorizontal: 12, paddingVertical: 8 }, liveDot: { backgroundColor: "#14AE5C", borderRadius: 4, height: 7, width: 7 }, liveText: { color: "#C4C4C4", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 27 },
  kpiCard: { backgroundColor: "#141414", borderColor: "#2A2A2A", borderRadius: 12, borderWidth: 1, flexBasis: 180, flexGrow: 1, minHeight: 112, paddingHorizontal: 17, paddingVertical: 15 },
  attentionKpi: { borderColor: "#4A2424" }, kpiLabel: { color: "#9C9C9C", fontSize: 10, fontWeight: "700", letterSpacing: 1.25 }, kpiValue: { color: "#FFFFFF", fontSize: 30, fontWeight: "700", marginTop: 7 }, kpiSub: { color: "#858585", fontSize: 11, marginTop: 2 },
  sectionHeader: { alignItems: "center", borderBottomColor: "#383838", borderBottomWidth: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingBottom: 12 },
  sectionTitle: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, sectionSub: { color: "#8A8A8A", fontSize: 12, marginTop: 6 }, count: { color: "#9C9C9C", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  toolbar: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between", paddingVertical: 13 },
  searchBox: { alignItems: "center", backgroundColor: "#141414", borderColor: "#333333", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 9, maxWidth: 440, minHeight: 42, paddingHorizontal: 12, width: "100%" },
  searchInput: { color: "#FFFFFF", flex: 1, fontSize: 13, minWidth: 0, paddingVertical: 8 }, sortHint: { color: "#777777", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  layoutToggle: { alignItems: "center", flexDirection: "row", gap: 6 }, layoutButton: { borderColor: "#333333", borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 }, layoutButtonActive: { backgroundColor: "#242424", borderColor: "#555555" }, layoutButtonText: { color: "#858585", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }, layoutButtonTextActive: { color: "#FFFFFF" },
  userList: { gap: 8, paddingTop: 2 }, userRow: { alignItems: "center", backgroundColor: "#111111", borderColor: "#242424", borderRadius: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 12, minHeight: 76, paddingHorizontal: 14, paddingVertical: 11 }, selectedUserRow: { backgroundColor: "#171717", borderColor: "#5A2929" },
  userGrid: { flexDirection: "row", flexWrap: "wrap" }, userGridItem: { flexBasis: 300, flexGrow: 1, minWidth: 260 },
  avatar: { alignItems: "center", backgroundColor: "#242424", borderRadius: 22, height: 42, justifyContent: "center", width: 42 }, avatarText: { color: "#E5E5E5", fontSize: 13, fontWeight: "800" },
  userDetails: { flex: 1, minWidth: 130 }, userName: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" }, userMeta: { color: "#8F8F8F", fontSize: 11, marginTop: 4 },
  reviewButton: { alignItems: "center", backgroundColor: "#242424", borderColor: "#3A3A3A", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 34, paddingHorizontal: 12 }, reviewText: { color: "#E0E0E0", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  assignButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, flexDirection: "row", gap: 3, height: 34, justifyContent: "center", paddingHorizontal: 12 }, assignText: { color: "#0A0A0A", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  assignmentPanel: { backgroundColor: "#101010", borderColor: "#2A2A2A", borderRadius: 0, borderWidth: 1, marginBottom: 8, marginTop: -2, padding: 16 },
  assignmentPanelHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 13 },
  assignmentPanelTitle: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 }, assignmentPanelSub: { color: "#858585", fontSize: 11, marginTop: 4 },
  filterButton: { alignItems: "center", borderColor: "#494949", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 8 }, filterButtonActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" }, filterText: { color: "#C4C4C4", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 }, filterTextActive: { color: "#0A0A0A" },
  assignmentToolbar: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 11 }, assignmentToolbarLabel: { color: "#777777", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginRight: 4 }, sortButton: { borderColor: "#333333", borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 }, sortButtonActive: { backgroundColor: "#242424", borderColor: "#555555" }, sortButtonText: { color: "#858585", fontSize: 9, fontWeight: "700", letterSpacing: 0.6 }, sortButtonTextActive: { color: "#FFFFFF" },
  assignmentEmpty: { color: "#858585", fontSize: 12, paddingVertical: 12 }, assignmentRow: { backgroundColor: "#151515", borderColor: "#2A2A2A", borderRadius: 9, borderWidth: 1, marginBottom: 8, padding: 12 },
  assignmentTopRow: { flexDirection: "row" }, assignmentDetails: { flex: 1, marginBottom: 10 }, expandButton: { alignItems: "center", borderColor: "#414141", borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", marginLeft: 8, width: 34 },
  assignmentName: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" }, assignmentDescription: { color: "#A5A5A5", fontSize: 12, lineHeight: 17, marginTop: 4 }, assignmentDue: { color: "#858585", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginTop: 7 },
  statusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, statusButton: { alignItems: "center", borderColor: "transparent", borderRadius: 999, borderWidth: 1, minHeight: 28, justifyContent: "center", paddingHorizontal: 9 }, selectedStatus: { borderColor: "#FFFFFF", borderWidth: 2 }, statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  emptyText: { color: "#999999", fontSize: 14, paddingVertical: 22 }, message: { color: "#FF7B7B", fontSize: 13, marginTop: 20 },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.76)", flex: 1, justifyContent: "flex-end" }, modalCard: { backgroundColor: "#141414", borderColor: "#333333", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, padding: 24, paddingBottom: 36 },
  feedbackCard: { backgroundColor: "#141414", borderColor: "#333333", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, maxHeight: "90%", padding: 24, paddingBottom: 32 }, feedbackHeading: { flex: 1, paddingRight: 16 }, feedbackContent: { paddingBottom: 4 },
  feedbackLabel: { color: "#858585", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 15 }, feedbackDescription: { color: "#C4C4C4", fontSize: 14, lineHeight: 21, marginBottom: 24 }, feedbackSectionTitle: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 1.3, marginBottom: 10 },
  feedbackMessage: { alignSelf: "flex-start", backgroundColor: "#202020", borderColor: "#333333", borderRadius: 10, borderWidth: 1, marginBottom: 8, maxWidth: "86%", padding: 11 }, adminMessage: { alignSelf: "flex-end", backgroundColor: "#302020", borderColor: "#633434" },
  feedbackSpeaker: { color: "#9C9C9C", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 4 }, feedbackMessageText: { color: "#E5E5E5", fontSize: 13, lineHeight: 18 }, feedbackEmpty: { color: "#999999", fontSize: 12, marginBottom: 12 }, feedbackInput: { height: 78, marginTop: 10, paddingTop: 13 },
  modalHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }, detailHeaderActions: { alignItems: "center", flexDirection: "row", gap: 12 }, editButton: { alignItems: "center", flexDirection: "row", gap: 4 }, editButtonText: { color: "#E5E5E5", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  modalKicker: { color: "#9C9C9C", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7 }, modalTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  input: { backgroundColor: "#1A1A1A", borderColor: "#383838", borderRadius: 9, borderWidth: 1, color: "#FFFFFF", fontSize: 15, height: 53, marginBottom: 13, paddingHorizontal: 14 }, descriptionInput: { height: 92, paddingTop: 14, textAlignVertical: "top" },
  inputLabel: { color: "#9C9C9C", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 },
  saveButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, flexDirection: "row", height: 50, justifyContent: "space-between", marginTop: 11, paddingHorizontal: 18 },
  notifyButton: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#242424", borderColor: "#474747", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, height: 42, justifyContent: "center", marginBottom: 23, paddingHorizontal: 14 },
  notificationMessage: { alignSelf: "center", backgroundColor: "#242020", borderColor: "#4A3030", borderWidth: 1, maxWidth: "100%" }, disabledButton: { opacity: 0.55 }, saveText: { color: "#0A0A0A", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  timelineCard: { borderRadius: 10, marginBottom: 12, padding: 14 },
  timelineHeading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 13 },
  timelineTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1 }, timelineSubtitle: { fontSize: 10, marginTop: 4 },
  timelineLegend: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 8 }, legendItem: { alignItems: "center", flexDirection: "row", gap: 4 }, legendDot: { borderRadius: 4, height: 8, width: 8 }, legendLabel: { fontSize: 8, fontWeight: "700" },
  timeline: { minWidth: 860 }, timelineHeaderRow: { alignItems: "center", flexDirection: "row", paddingBottom: 8 },
  timelineTaskHeader: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, width: 190 },
  timelineMonthHeader: { flex: 1, flexDirection: "row" }, timelineMonth: { flex: 1, fontSize: 9, fontWeight: "800", textAlign: "center" },
  timelineRow: { alignItems: "center", flexDirection: "row", minHeight: 52 },
  timelineTask: { justifyContent: "center", paddingRight: 10, width: 190 }, timelineTaskName: { fontSize: 11, fontWeight: "700" }, timelineTaskDue: { fontSize: 8, fontWeight: "700", marginTop: 3 },
  timelineMonths: { flex: 1, flexDirection: "row", height: 36 }, timelineMonthCell: { alignItems: "center", justifyContent: "center", width: `${100 / 12}%` },
  timelineBar: { height: 17, width: "100%" }, timelineBarStart: { borderBottomLeftRadius: 9, borderTopLeftRadius: 9 }, timelineBarEnd: { borderBottomRightRadius: 9, borderTopRightRadius: 9 },
  timelineBarMarker: { borderRadius: 4, height: 7, left: 4, position: "absolute", top: 5, width: 7 },
  timelineHint: { fontSize: 10, marginTop: 10 },
}), StyleSheet.create({
    content: { backgroundColor: "#F6F6F6" },
    header: { borderBottomColor: "#E2E2E2" },
    brandFirst: { color: "#111111" }, brandStop: { color: "#777777" },
    adminMark: { backgroundColor: "#FFFFFF", borderColor: "#E1E1E1" }, adminMarkText: { color: "#555555" },
    signOutButton: { borderColor: "#DDDDDD" }, signOutText: { color: "#555555" },
    kicker: { color: "#737373" }, heading: { color: "#111111" }, intro: { color: "#666666" },
    liveBadge: { backgroundColor: "#FFFFFF", borderColor: "#E2E2E2" }, liveText: { color: "#555555" },
    kpiCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E1E1" },
    attentionKpi: { borderColor: "#EBC9C9" }, kpiLabel: { color: "#777777" }, kpiValue: { color: "#111111" }, kpiSub: { color: "#777777" },
    sectionHeader: { borderBottomColor: "#DADADA" }, sectionTitle: { color: "#111111" }, sectionSub: { color: "#707070" }, count: { color: "#777777" },
    searchBox: { backgroundColor: "#FFFFFF", borderColor: "#DDDDDD" }, searchInput: { color: "#111111" }, sortHint: { color: "#777777" },
    layoutButton: { borderColor: "#DDDDDD" }, layoutButtonActive: { backgroundColor: "#EFEFEF", borderColor: "#C9C9C9" }, layoutButtonText: { color: "#777777" }, layoutButtonTextActive: { color: "#111111" },
    userRow: { backgroundColor: "#FFFFFF", borderColor: "#E3E3E3" }, selectedUserRow: { backgroundColor: "#FFF8F8", borderColor: "#E9B6B6" },
    avatar: { backgroundColor: "#F7E6E6" }, avatarText: { color: "#B53D36" }, userName: { color: "#171717" }, userMeta: { color: "#777777" },
    reviewButton: { backgroundColor: "#F5F5F5", borderColor: "#DDDDDD" }, reviewText: { color: "#444444" },
    assignButton: { backgroundColor: "#D6453D" }, assignText: { color: "#FFFFFF" },
    assignmentPanel: { backgroundColor: "#FFFFFF", borderColor: "#E1E1E1", borderRadius: 10 },
    assignmentPanelTitle: { color: "#333333" }, assignmentPanelSub: { color: "#777777" },
    filterButton: { borderColor: "#D2D2D2" }, filterButtonActive: { backgroundColor: "#D6453D", borderColor: "#D6453D" }, filterText: { color: "#555555" }, filterTextActive: { color: "#FFFFFF" },
    assignmentToolbarLabel: { color: "#777777" }, sortButton: { borderColor: "#DDDDDD" }, sortButtonActive: { backgroundColor: "#F1F1F1", borderColor: "#BBBBBB" }, sortButtonText: { color: "#777777" }, sortButtonTextActive: { color: "#222222" },
    assignmentEmpty: { color: "#777777" }, assignmentRow: { backgroundColor: "#FFFFFF", borderColor: "#E2E2E2" }, expandButton: { borderColor: "#E5B7B7" },
    assignmentName: { color: "#171717" }, assignmentDescription: { color: "#606060" }, assignmentDue: { color: "#777777" }, selectedStatus: { borderColor: "#222222" },
    emptyText: { color: "#666666" }, message: { color: "#B53D36" },
    modalBackdrop: { backgroundColor: "rgba(20,20,20,0.42)" }, modalCard: { backgroundColor: "#FFFFFF", borderColor: "#E2E2E2" }, feedbackCard: { backgroundColor: "#FFFFFF", borderColor: "#E2E2E2" },
    feedbackLabel: { color: "#777777" }, feedbackDescription: { color: "#444444" }, feedbackSectionTitle: { color: "#111111" },
    feedbackMessage: { backgroundColor: "#F3F3F3", borderColor: "#E5E5E5" }, adminMessage: { backgroundColor: "#FBEDED", borderColor: "#F0D0D0" },
    feedbackSpeaker: { color: "#777777" }, feedbackMessageText: { color: "#222222" }, feedbackEmpty: { color: "#777777" }, editButtonText: { color: "#333333" },
    modalKicker: { color: "#777777" }, modalTitle: { color: "#111111" },
    input: { backgroundColor: "#FFFFFF", borderColor: "#D8D8D8", color: "#111111" }, inputLabel: { color: "#777777" },
    saveButton: { backgroundColor: "#D6453D" }, notifyButton: { backgroundColor: "#D6453D", borderColor: "#D6453D" },
    notificationMessage: { backgroundColor: "#FFF0EE", borderColor: "#F0C2BE" }, saveText: { color: "#FFFFFF" },
    timelineCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E1E1", borderRadius: 10, marginBottom: 12, padding: 14 },
    timelineHeading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 13 },
    timelineTitle: { color: "#222222", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 }, timelineSubtitle: { color: "#777777", fontSize: 10, marginTop: 4 },
    timelineLegend: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 8 }, legendItem: { alignItems: "center", flexDirection: "row", gap: 4 }, legendDot: { borderRadius: 4, height: 8, width: 8 }, legendLabel: { color: "#666666", fontSize: 8, fontWeight: "700" },
    timeline: { minWidth: 860 }, timelineHeaderRow: { alignItems: "center", borderBottomColor: "#DADADA", borderBottomWidth: 1, flexDirection: "row", paddingBottom: 8 },
    timelineTaskHeader: { color: "#777777", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, width: 190 },
    timelineMonthHeader: { flex: 1, flexDirection: "row" }, timelineMonth: { color: "#777777", flex: 1, fontSize: 9, fontWeight: "800", textAlign: "center" },
    timelineRow: { alignItems: "center", borderBottomColor: "#EEEEEE", borderBottomWidth: 1, flexDirection: "row", minHeight: 52 },
    timelineTask: { justifyContent: "center", paddingRight: 10, width: 190 }, timelineTaskName: { color: "#222222", fontSize: 11, fontWeight: "700" }, timelineTaskDue: { color: "#777777", fontSize: 8, fontWeight: "700", marginTop: 3 },
    timelineMonths: { flex: 1, flexDirection: "row", height: 36 }, timelineMonthCell: { alignItems: "center", borderLeftColor: "#F0F0F0", borderLeftWidth: 1, justifyContent: "center", width: `${100 / 12}%` },
    timelineBar: { height: 17, width: "100%" }, timelineBarStart: { borderBottomLeftRadius: 9, borderTopLeftRadius: 9 }, timelineBarEnd: { borderBottomRightRadius: 9, borderTopRightRadius: 9 },
    timelineBarMarker: { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 4, height: 7, left: 4, position: "absolute", top: 5, width: 7 },
    timelineHint: { color: "#777777", fontSize: 10, marginTop: 10 },
  }));