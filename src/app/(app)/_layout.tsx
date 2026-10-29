import "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

export default function AppLayout() {
  // This renders the navigation stack for all authenticated app routes.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerShown: true,
          drawerType: "back",
          drawerActiveTintColor: "#D6453D",
          drawerInactiveTintColor: "#555",
          drawerLabelStyle: {
            fontFamily: "Sora",
          },
        }}
      >
        <Drawer.Screen
          name="admin"
          options={{
            drawerLabel: "Admin",
            headerTitle: "Admin",
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
            drawerIcon: ({ size, color }) => (
              <Ionicons name="log-out-outline" size={size} color={color} />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
