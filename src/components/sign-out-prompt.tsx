import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface SignOutPromptProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SignOutPrompt({ visible, onCancel, onConfirm }: SignOutPromptProps) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign out?</Text>
          <Text style={styles.message}>You will be returned to the sign-in screen.</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={styles.confirmButton}>
              <Text style={styles.confirmText}>SIGN OUT</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: "center", backgroundColor: "rgba(17,17,17,0.45)", flex: 1, justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 8, maxWidth: 380, padding: 24, width: "100%" },
  title: { color: "#111111", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  message: { color: "#666666", fontSize: 14, lineHeight: 20, marginBottom: 24 },
  actions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  cancelButton: { alignItems: "center", borderColor: "#DDDDDD", borderRadius: 5, borderWidth: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 16 },
  cancelText: { color: "#333333", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  confirmButton: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 5, justifyContent: "center", minHeight: 42, paddingHorizontal: 16 },
  confirmText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
});
