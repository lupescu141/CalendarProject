import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "../ctx";
import { BurgerMenu } from "../components/burgerMenu";

export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailInputFocused, setIsEmailFocused] = useState(false);
  const [passwordInputFocused, setIsPasswordFocused] = useState(false);
  const [buttonisHovered, setIsButtonHovered] = useState(false);

  const handleButtonHover = () => {
    setIsButtonHovered(true);
  };

  const handleButtonLeave = () => {
    setIsButtonHovered(false);
  };

  const handleEmailFocus = () => {
    setIsEmailFocused(true);
  };

  const handleEmailBlur = () => {
    setIsEmailFocused(false);
  };

  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
  };

  const handlePasswordBlur = () => {
    setIsPasswordFocused(false);
  };
  return (
    <View style={styles.body}>
      <BurgerMenu />
      <View style={styles.logo_container}>
        <Image
          contentFit="contain"
          source={require("../assets/images/logo.svg")}
          style={styles.logo}
        />
        <Text style={styles.logo_undertext}>VUOSIRENGAS</Text>
      </View>

      <View style={styles.input_container}>
        <Text style={styles.input_header}>Email</Text>
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          onFocus={handleEmailFocus}
          onBlur={handleEmailBlur}
          style={[styles.input_box, emailInputFocused && styles.isFocused]}
        />
        <Text style={styles.input_header}>Password</Text>
        <TextInput
          placeholder="Password"
          textContentType="password"
          onFocus={handlePasswordFocus}
          onBlur={handlePasswordBlur}
          style={[styles.input_box, passwordInputFocused && styles.isFocused]}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}

      <Pressable
        disabled={isSubmitting}
        onPress={async () => {
          setError("");
          setIsSubmitting(true);
          try {
            await signIn({ email, password });
            router.replace("/(app)/calendar");
          } catch (signInError) {
            setError(
              signInError instanceof Error
                ? signInError.message
                : "Sign in failed.",
            );
          } finally {
            setIsSubmitting(false);
          }
        }}
        onHoverIn={handleButtonHover}
        onHoverOut={handleButtonLeave}
        style={[
          styles.login_button,
          buttonisHovered && { backgroundColor: "#B53A33" },
        ]}
      >
        <Text style={styles.login_label}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: "100%", height: "100%" },
  logo_undertext: {
    fontSize: 30,
    fontWeight: "bold",
    marginTop: -12,
    color: "#D6453D",
  },
  logo_container: {
    width: "100%",
    height: "20%",
    marginBottom: 20,
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  input_header: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333333",
    alignSelf: "flex-start",
    marginLeft: "10%",
  },

  input_box: {
    width: "80%",
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    marginTop: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },
  isFocused: {
    borderColor: "#D6453D",
  },
  input_container: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },

  login_button: {
    backgroundColor: "#D6453D",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  login_label: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Sora",
  },
  error: {
    color: "#B53A33",
    marginBottom: 12,
    maxWidth: "80%",
    textAlign: "center",
  },
});
