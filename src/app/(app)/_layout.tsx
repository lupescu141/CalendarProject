import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
SplashScreen.preventAutoHideAsync();

export default function AppLayout() {
  const [loaded, error] = useFonts({
    Sora: require("@/assets/fonts/Sora/Sora-VariableFont_wght.ttf"),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  // This renders the navigation stack for all authenticated app routes.
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "center",
        headerTitleStyle: { fontFamily: "Sora" },
      }}
    >
      <Stack.Screen name="admin" options={{ title: "Admin" }} />
      <Stack.Screen name="calendar" options={{ title: "Calendar" }} />
      <Stack.Screen name="index" options={{ title: "Sign out" }} />
    </Stack>
  );
}