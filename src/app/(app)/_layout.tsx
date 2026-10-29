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
          drawerActiveTintColor: "#ed1c24",
          drawerInactiveTintColor: "#333333",
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
