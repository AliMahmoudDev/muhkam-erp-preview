import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const AMBER = "#F59E0B";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

const TABS: { name: string; label: string; icon: FeatherIconName; iconActive: FeatherIconName }[] = [
  { name: "index",      label: "الرئيسية", icon: "home",          iconActive: "home" },
  { name: "sales",      label: "المبيعات", icon: "shopping-cart", iconActive: "shopping-cart" },
  { name: "inventory",  label: "المخزون",  icon: "package",       iconActive: "package" },
  { name: "customers",  label: "العملاء",  icon: "users",         iconActive: "users" },
  { name: "more",       label: "المزيد",   icon: "grid",          iconActive: "grid" },
];

function TabIcon({ name, color, focused }: { name: FeatherIconName; color: string; focused: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: focused ? 1.15 : 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [focused, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.iconContainer,
        focused && styles.iconContainerActive,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Feather name={name} size={22} color={color} />
      {focused && <View style={styles.activeIndicator} />}
    </Animated.View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: AMBER,
        tabBarInactiveTintColor: "#8E8E93",
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS || isWeb ? "transparent" : (colors.isDark ? "#000000" : "#FFFFFF"),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          elevation: 0,
          height: isWeb ? 84 : Platform.OS === "ios" ? 88 : 68,
          paddingBottom: isWeb ? 32 : Platform.OS === "ios" ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: "Tajawal_500Medium",
          fontSize: 10,
          marginTop: 2,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={colors.isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.isDark ? "rgba(0,0,0,0.96)" : "rgba(255,255,255,0.96)",
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                },
              ]}
            />
          ),
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? tab.iconActive : tab.icon} color={color} focused={focused} />
            ),
          }}
        />
      ))}
      {/* Hidden tabs */}
      <Tabs.Screen name="attendance" options={{ href: null, title: "الحضور" }} />
      <Tabs.Screen name="reports"    options={{ href: null, title: "التقارير" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 32,
    borderRadius: 10,
    position: "relative",
  },
  iconContainerActive: {
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  activeIndicator: {
    position: "absolute",
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: AMBER,
  },
});
