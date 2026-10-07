import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { SessionProvider, useSession } from "../ctx";
import { SplashScreenController } from "../splash";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

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
      <SplashScreenController />
      <RootNavigator />
    </SessionProvider>
  );
}

// All of the above code remains unchanged. Update the `RootNavigator` to protect routes based on your `SessionProvider` below.

function RootNavigator() {
  const { session } = useSession();

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
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
