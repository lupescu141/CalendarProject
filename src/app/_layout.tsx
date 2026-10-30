import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SessionProvider, useSession } from "../ctx";
import { SplashScreenController } from "../splash";
SplashScreen.preventAutoHideAsync();

export default function Root() {
  const [loaded, error] = useFonts({
    Sora: require("../assets/fonts/Sora/Sora-VariableFont_wght.ttf"),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }
  // Set up the auth context and render your layout inside of it.
  return (
    <SessionProvider>
      <KeyboardProvider>
        <SplashScreenController />
        <StatusBar style="dark" />
        <RootNavigator />
      </KeyboardProvider>
    </SessionProvider>
  );
}

// All of the above code remains unchanged. Update the `RootNavigator` to protect routes based on your `SessionProvider` below.

function RootNavigator() {
  const { session } = useSession();

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen
          name="(app)"
          options={{
            // Hide the header for this route
            headerShown: false,
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen
          name="sign-in"
          options={{
            // Hide the header for this route
            headerShown: false,
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}