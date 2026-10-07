import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../ctx";

export default function ChooseDestination() {
  const router = useRouter();
  const { currentUser } = useSession();

  useEffect(() => {
    if (!currentUser?.admin) router.replace("/(app)/calendar");
  }, [currentUser, router]);

  if (!currentUser?.admin) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>WELCOME BACK</Text>
      <Text style={styles.title}>Where would you like to go?</Text>
      <Text style={styles.description}>Choose a calendar or open the administration menu.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/(app)/calendar")} style={styles.option}>
        <View style={styles.icon}><Ionicons name="calendar-outline" size={21} color="#D6453D" /></View>
        <View style={styles.optionCopy}><Text style={styles.optionTitle}>Calendar</Text><Text style={styles.optionDescription}>View your assignments</Text></View>
        <Ionicons name="chevron-forward" size={19} color="#888888" />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/(app)/admin")} style={styles.option}>
        <View style={[styles.icon, styles.adminIcon]}><Ionicons name="shield-checkmark-outline" size={21} color="#FFFFFF" /></View>
        <View style={styles.optionCopy}><Text style={styles.optionTitle}>Admin menu</Text><Text style={styles.optionDescription}>Manage team assignments</Text></View>
        <Ionicons name="chevron-forward" size={19} color="#888888" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#FFFFFF", flex: 1, justifyContent: "center", padding: 28 },
  kicker: { color: "#777777", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 },
  title: { color: "#111111", fontSize: 29, fontWeight: "900", marginBottom: 8 },
  description: { color: "#777777", fontSize: 14, lineHeight: 21, marginBottom: 28 },
  option: { alignItems: "center", borderColor: "#DDDDDD", borderRadius: 7, borderWidth: 1, flexDirection: "row", marginBottom: 12, padding: 15 },
  icon: { alignItems: "center", backgroundColor: "#FBEDEC", borderRadius: 5, height: 42, justifyContent: "center", width: 42 },
  adminIcon: { backgroundColor: "#111111" },
  optionCopy: { flex: 1, marginHorizontal: 13 },
  optionTitle: { color: "#111111", fontSize: 15, fontWeight: "800", marginBottom: 3 },
  optionDescription: { color: "#777777", fontSize: 12 },
});
