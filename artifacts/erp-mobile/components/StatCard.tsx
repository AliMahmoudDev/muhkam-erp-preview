import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: c.isDark ? "#111111" : "#FFFFFF",
          borderColor: c.cardBorder,
          borderLeftColor: iconColor,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: iconColor + "18" }]}>
          <Feather name={icon} size={16} color={iconColor} />
        </View>
        {trend === "up" && (
          <View style={[styles.trendBadge, { backgroundColor: "#10B98118" }]}>
            <Feather name="trending-up" size={11} color="#10B981" />
          </View>
        )}
        {trend === "down" && (
          <View style={[styles.trendBadge, { backgroundColor: "#EF444418" }]}>
            <Feather name="trending-down" size={11} color="#EF4444" />
          </View>
        )}
      </View>

      <Text style={[styles.value, { color: c.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.title, { color: c.mutedForeground }]}>{title}</Text>

      {subtitle && (
        <Text style={[
          styles.subtitle,
          { color: trend === "up" ? "#10B981" : trend === "down" ? "#EF4444" : c.mutedForeground }
        ]}>
          {subtitle}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 3,
    alignItems: "flex-end",
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  trendBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  value: {
    fontSize: 21,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 11,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 10,
    fontFamily: "Tajawal_500Medium",
    marginTop: 3,
    textAlign: "right",
  },
});
