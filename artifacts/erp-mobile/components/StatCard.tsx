import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  color?: string;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ title, value, subtitle, icon, color, trend }: StatCardProps) {
  const c = useColors();
  const iconColor = color || "#F59E0B";

  return (
    <View style={[styles.card, { borderColor: iconColor + "30" }]}>
      <LinearGradient
        colors={c.isDark ? ["#1C2340", "#141828"] : ["#FFFFFF", "#F8FAFC"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glow, { backgroundColor: iconColor + "18" }]} />

      <View style={[styles.iconWrap, { backgroundColor: iconColor + "20", borderColor: iconColor + "35" }]}>
        <Feather name={icon} size={18} color={iconColor} />
      </View>

      <Text style={[styles.value, { color: c.text }]}>{value}</Text>
      <Text style={[styles.title, { color: c.mutedForeground }]}>{title}</Text>

      {subtitle && (
        <View style={styles.trendRow}>
          {trend === "up" && <Feather name="trending-up" size={10} color="#10B981" />}
          {trend === "down" && <Feather name="trending-down" size={10} color="#EF4444" />}
          <Text style={[
            styles.subtitle,
            { color: trend === "up" ? "#10B981" : trend === "down" ? "#EF4444" : c.mutedForeground }
          ]}>{subtitle}</Text>
        </View>
      )}

      <View style={[styles.bar, { backgroundColor: iconColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    alignItems: "flex-end",
    overflow: "hidden",
    position: "relative",
  },
  glow: {
    position: "absolute",
    top: -18,
    right: -18,
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  value: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 11,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
  trendRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: "Tajawal_500Medium",
  },
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    opacity: 0.8,
  },
});
