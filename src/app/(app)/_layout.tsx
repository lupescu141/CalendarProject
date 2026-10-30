import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Drawer } from "expo-router/drawer";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerShown: true,
          drawerType: "back",
          drawerActiveTintColor: "#ed1c24",
          drawerInactiveTintColor: "#333333",
          drawerLabelStyle: {
            fontFamily: "Sora",
          },
          headerTitleStyle: {
            fontFamily: "Sora",
          },
        }}
      >
        <Drawer.Screen
          name="admin"
          options={{
            drawerLabel: "Admin",
            headerTitle: "Admin",
            headerTitleAlign: "center",
            drawerIcon: ({ size, color }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="calendar"
          options={{
            drawerLabel: "Calendar",
            headerTitle: "Calendar",
            headerTitleAlign: "center",
            drawerIcon: ({ size, color }) => (
              <Ionicons
                name="calendar-number-outline"
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: "Sign out",
            headerTitle: "Sign out",
            headerTitleAlign: "center",
            drawerIcon: ({ size, color }) => (
              <Ionicons name="log-out-outline" size={size} color={color} />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}