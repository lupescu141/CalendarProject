import { Stack } from "expo-router";

import { SessionProvider, useSession } from "../ctx";
import { SplashScreenController } from "../splash";
import { StatusBar } from "expo-status-bar";

export default function Root() {
  // Set up the auth context and render your layout inside of it.
  return (
    <SessionProvider>
      <SplashScreenController />
      <StatusBar style="dark" />
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
