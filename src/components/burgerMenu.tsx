import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import {
  Animated,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

export const BurgerMenu = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = Math.min(320, screenWidth * 0.84);
  const [slide] = useState(() => new Animated.Value(-drawerWidth));
  const [backdropOpacity] = useState(() => new Animated.Value(0));

  const menuItems = [
    { label: "Home", route: "/(app)/calendar" },
    { label: "Sign In", route: "/sign-in" },
  ] as const;

  useEffect(() => {
    if (!isVisible) return;

    slide.setValue(-drawerWidth);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 240,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [backdropOpacity, drawerWidth, isVisible, slide]);

  function closeMenu() {
    slide.stopAnimation();
    backdropOpacity.stopAnimation();
    setIsVisible(false);
  }

  return (
    <View style={styles.menu_container}>
      <View
        style={[
          styles.toolbar_container,
          isVisible && styles.toolbarHidden,
        ]}
      >
        <Image
          contentFit="contain"
          source={require("../assets/images/logo.svg")}
          style={styles.barlogo}
        />

        <Pressable
          accessibilityLabel={isVisible ? "Close menu" : "Open menu"}
          accessibilityRole="button"
          onPress={() => {
            if (isVisible) closeMenu();
            else setIsVisible(true);
          }}
          hitSlop={10}
          style={styles.menuToggle}
        >
          <Ionicons name={isVisible ? "close" : "menu"} size={28} color="#333" />
        </Pressable>
      </View>

      <Modal
        animationType="none"
        onRequestClose={closeMenu}
        transparent
        visible={isVisible}
      >
        <View style={styles.modal}>
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          />
          <Pressable
            accessibilityLabel="Close menu"
            accessibilityRole="button"
            onPress={closeMenu}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.drawer,
              { width: drawerWidth, transform: [{ translateX: slide }] },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Image
                source={require("../assets/images/logo.svg")}
                contentFit="contain"
                style={styles.drawerLogo}
              />
              <Pressable
                accessibilityLabel="Close menu"
                accessibilityRole="button"
                hitSlop={10}
                onPress={closeMenu}
              >
                <Ionicons name="close" size={27} color="#333" />
              </Pressable>
            </View>
            <View style={styles.menuItems}>
              {menuItems.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    closeMenu();
                    router.push(item.route);
                  }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <Text style={styles.menuItemText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#D6453D" />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  toolbar_container: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  toolbarHidden: {
    display: "none",
  },
  barlogo: {
    width: 100,
    height: 40,
  },
  menuToggle: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  menu_container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  modal: {
    flex: 1,
    justifyContent: "flex-start",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  drawer: {
    backgroundColor: "#2b2a29",
    elevation: 16,
    flex: 1,
    maxWidth: "84%",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  drawerHeader: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomColor: "#e5e5e5",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 72,
    paddingHorizontal: 20,
  },
  drawerLogo: {
    height: 34,
    width: 160,
  },
  menuItems: {
    paddingTop: 14,
  },
  menuItem: {
    alignItems: "center",
    borderBottomColor: "rgba(255,255,255,0.12)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 17,
  },
  menuItemPressed: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  menuItemText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
