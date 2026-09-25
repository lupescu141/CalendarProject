import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { createAssignment, listUsers, type UserRecord } from "../../lib/adminApi";

const today = new Date();
const defaultDueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
  .toISOString()
  .slice(0, 10);

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

  useEffect(() => {
    let mounted = true;
    listUsers()
      .then((records) => { if (mounted) setUsers(records.filter((user) => !user.admin)); })
      .catch(() => { if (mounted) setMessage("Could not load users. Check the database connection."); })
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
        user_id: selectedUser.id,
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
      {!loading && users.length === 0 && <Text style={styles.emptyText}>No non-admin users found.</Text>}
      <View style={styles.userList}>
        {users.map((user) => (
          <View key={user.id} style={styles.userRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{user.firstname.charAt(0)}{user.surname.charAt(0)}</Text></View>
            <View style={styles.userDetails}><Text style={styles.userName}>{user.firstname} {user.surname}</Text><Text style={styles.userMeta}>{user.email}  ·  {user.facility}</Text></View>
            <Pressable accessibilityLabel={`Assign work to ${user.firstname} ${user.surname}`} accessibilityRole="button" onPress={() => openAssignment(user)} style={styles.assignButton}>
              <Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.assignText}>ASSIGN</Text>
            </Pressable>
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
  emptyText: { color: "#777777", fontSize: 14, paddingVertical: 22 }, message: { color: "#D6453D", fontSize: 13, marginTop: 20 }, modalBackdrop: { backgroundColor: "rgba(17,17,17,0.4)", flex: 1, justifyContent: "flex-end" }, modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: 24, paddingBottom: 36 },
  modalHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }, modalKicker: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7 }, modalTitle: { color: "#111111", fontSize: 24, fontWeight: "900" }, input: { borderColor: "#D6D6D6", borderRadius: 5, borderWidth: 1, color: "#111111", fontSize: 15, height: 53, marginBottom: 13, paddingHorizontal: 14 }, descriptionInput: { height: 92, paddingTop: 14, textAlignVertical: "top" }, inputLabel: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 }, saveButton: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 5, flexDirection: "row", height: 56, justifyContent: "space-between", marginTop: 11, paddingHorizontal: 18 }, disabledButton: { opacity: 0.6 }, saveText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
});