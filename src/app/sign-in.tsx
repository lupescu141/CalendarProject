import { router } from "expo-router";
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
import { Image } from "expo-image";
import { useSession } from "../ctx";
import { useState } from "react";

export default function SignIn() {
  const { signIn } = useSession();
  const [emailInputFocused, setIsEmailFocused] = useState(false);
  const [passwordInputFocused, setIsPasswordFocused] = useState(false);

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
      <View style={styles.logo_container}>
        <Image
          source={require("../assets/images/logo.svg")}
          style={styles.logo}
        />
        <Text style={styles.logo_undertext}>VUOSIKELLO</Text>
      </View>

      <View style={styles.input_container}>
        <TextInput
          placeholder="Email"
          textContentType="emailAddress"
          onFocus={handleEmailFocus}
          onBlur={handleEmailBlur}
          style={[styles.input_box, emailInputFocused && styles.isFocused]}
        />
        <TextInput
          placeholder="Password"
          textContentType="password"
          onFocus={handlePasswordFocus}
          onBlur={handlePasswordBlur}
          style={[styles.input_box, passwordInputFocused && styles.isFocused]}
          secureTextEntry
        />
      </View>

      <Text
        style={styles.login_button}
        onPress={() => {
          signIn();
          // Navigate after signing in. You may want to tweak this to ensure sign-in is successful before navigating.
          router.replace("/(app)/calendar");
        }}
      >
        Sign In
      </Text>
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
  logo: { width: "100%", height: "100%", resizeMode: "contain" },
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
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
