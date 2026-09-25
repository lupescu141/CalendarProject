import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Index() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <View style={styles.markLine} />
            <View style={styles.markLineShort} />
          </View>
          <Text style={styles.brandName}><Text style={styles.brandFirst}>first</Text><Text style={styles.brandStop}>stop</Text></Text>
          <View style={styles.statusDot} />
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>YOUR TIME, TOGETHER</Text>
            <Text style={styles.heading}>Welcome{"\n"}back.</Text>
            <Text style={styles.intro}>Your days have a place here. Pick up right where you left off.</Text>
          </View>
          <View style={styles.calendarBadge}>
            <Text style={styles.badgeMonth}>SEP</Text>
            <Text style={styles.badgeDay}>18</Text>
            <View style={styles.badgeRule} />
            <Text style={styles.badgeLabel}>THU</Text>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={19} color="#8A8F84" />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={(value) => { setEmail(value); setSubmitted(false); }}
                placeholder="you@example.com"
                placeholderTextColor="#A9AEA4"
                style={styles.input}
                value={email}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>PASSWORD</Text>
              <Pressable accessibilityRole="button" onPress={() => {}}><Text style={styles.forgot}>FORGOT?</Text></Pressable>
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={19} color="#8A8F84" />
              <TextInput
                onChangeText={(value) => { setPassword(value); setSubmitted(false); }}
                placeholder="Enter your password"
                placeholderTextColor="#A9AEA4"
                secureTextEntry={!showPassword}
                style={styles.input}
                value={password}
              />
              <Pressable
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setShowPassword((visible) => !visible)}
              >
                <Ionicons color="#8A8F84" name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} />
              </Pressable>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSubmitted(true);
              router.push("/calendar");
            }}
            style={({ pressed }) => [styles.loginButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.loginText}>LOG IN</Text>
            <Ionicons name="arrow-forward" size={20} color="#18211C" />
          </Pressable>
          {submitted && <Text style={styles.feedback}>{email && password ? "You're on your way in." : "Enter your email and password to continue."}</Text>}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>NEW TO FIRSTSTOP?</Text>
          <Pressable accessibilityRole="button" onPress={() => {}}><Text style={styles.createText}>CREATE AN ACCOUNT</Text></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 28 },
  topBar: { alignItems: "center", flexDirection: "row", marginBottom: 74 },
  brandMark: { backgroundColor: "#D6453D", borderRadius: 5, height: 27, justifyContent: "center", marginRight: 8, paddingHorizontal: 6, transform: [{ rotate: "-7deg" }], width: 29 },
  markLine: { backgroundColor: "#111111", height: 3, marginBottom: 4, width: 17 },
  markLineShort: { backgroundColor: "#111111", height: 3, width: 11 },
  brandName: { fontSize: 18, fontWeight: "800", letterSpacing: 0.2 },
  brandFirst: { color: "#111111" },
  brandStop: { color: "#D6453D" },
  statusDot: { backgroundColor: "#D6453D", borderRadius: 4, height: 8, marginLeft: 6, width: 8 },
  heroRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 52 },
  heroCopy: { flex: 1, paddingRight: 16 },
  kicker: { color: "#6B6B6B", fontSize: 11, fontWeight: "800", letterSpacing: 1.6, marginBottom: 13 },
  heading: { color: "#111111", fontSize: 51, fontWeight: "900", letterSpacing: -1.7, lineHeight: 49 },
  intro: { color: "#666666", fontSize: 15, lineHeight: 23, marginTop: 18, maxWidth: 260 },
  calendarBadge: { backgroundColor: "#D6453D", borderRadius: 4, height: 136, padding: 14, transform: [{ rotate: "5deg" }], width: 101 },
  badgeMonth: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  badgeDay: { color: "#FFFFFF", fontSize: 48, fontWeight: "900", lineHeight: 52 },
  badgeRule: { backgroundColor: "#E89A95", height: 1, marginBottom: 9, width: "100%" },
  badgeLabel: { color: "#F8DAD8", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  form: { gap: 25 },
  fieldGroup: { gap: 9 },
  labelRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#666666", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  forgot: { color: "#D6453D", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  inputWrap: { alignItems: "center", backgroundColor: "#F2F2F2", borderColor: "#D5D5D5", borderRadius: 5, borderWidth: 1, flexDirection: "row", height: 57, paddingHorizontal: 16 },
  input: { color: "#111111", flex: 1, fontSize: 15, marginLeft: 11, paddingVertical: 0 },
  loginButton: { alignItems: "center", backgroundColor: "#D6453D", borderRadius: 5, flexDirection: "row", height: 59, justifyContent: "space-between", marginTop: 8, paddingHorizontal: 20 },
  buttonPressed: { opacity: 0.78 },
  loginText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", letterSpacing: 1.8 },
  feedback: { color: "#D6453D", fontSize: 13, marginTop: -12 },
  footer: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: "auto", paddingTop: 54 },
  footerText: { color: "#888888", fontSize: 10, fontWeight: "700", letterSpacing: 1.1, marginRight: 8 },
  createText: { color: "#D6453D", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
});
