import { useState } from "react";
import { Squash as HamburgerSquash } from "hamburger-react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";

export const BurgerMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={styles.toolbar_container}>
      <Image
        source={require("../assets/images/logo.svg")}
        style={styles.barlogo}
      />
      <HamburgerSquash toggled={isOpen} toggle={setIsOpen} />
    </View>
  );
};

const styles = StyleSheet.create({
  toolbar_container: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    borderBottomStyle: "solid",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    position: "fixed",
    top: 0,
  },
  barlogo: {
    width: 100,
    height: 40,
    resizeMode: "contain",
  },
});
