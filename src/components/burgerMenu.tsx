import { useState } from "react";
import { Squash as HamburgerSquash } from "hamburger-react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { bubble as Menu } from "react-burger-menu";

export const BurgerMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={styles.menu_container}>
      <View style={styles.toolbar_container}>
        <Image
          source={require("../assets/images/logo.svg")}
          style={styles.barlogo}
        />
        <HamburgerSquash toggled={isOpen} toggle={setIsOpen} />
      </View>

      <View>
        <Menu
          width={"25%"}
          right
          isOpen={isOpen}
          onStateChange={(state) => setIsOpen(state.isOpen)}
          styles={menustyles}
        >
          <View style={styles.menu}>
            <nav className="bm-item-list" style={styles.nav}>
              <a className="menu-item" href="/" style={styles.menuItem}>
                Home
              </a>
              <a className="menu-item" href="/about" style={styles.menuItem}>
                About
              </a>
              <a className="menu-item" href="/contact" style={styles.menuItem}>
                Contact
              </a>
            </nav>
          </View>
        </Menu>
      </View>
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
  },
  barlogo: {
    width: 100,
    height: 40,
    resizeMode: "contain",
  },
  menu_container: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    top: 0,
    zIndex: 1000,
  },
  menuItem: {
    color: "#333",
    fontSize: 18,
    fontWeight: "bold",
    padding: 20,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    marginLeft: 40,
    marginTop: 25,
    overflow: "hidden",
    alignItems: "center",
  },
  menu: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    height: "100%",
    width: "100%",
    backgroundColor: "#fff",
  },
});

let menustyles = {
  bmMenuWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    position: "fixed",
    height: "100%",
    fill: "#fff",
  },
};
