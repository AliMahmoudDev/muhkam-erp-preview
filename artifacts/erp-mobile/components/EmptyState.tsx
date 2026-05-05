import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const AMBER = "#F59E0B";

interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  color?: string;
}

export function EmptyState({
  icon = "inbox",
  title,
  subtitle,
  actionLabel,
  onAction,
  color = AMBER,
}: EmptyStateProps) {
  const c = useColors();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={[styles.iconOuter, { backgroundColor: color + "10", borderColor: color + "20" }]}>
          <View style={[styles.iconInner, { backgroundColor: color + "20" }]}>
            <Feather name={icon} size={30} color={color} />
          </View>
        </View>
      </Animated.View>

      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: c.mutedForeground }]}>{subtitle}</Text>
      ) : null}

      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: color }]}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: color === AMBER ? "#000000" : "#FFFFFF" }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    flex: 1,
    gap: 0,
  },
  iconOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 260,
  },
  btn: {
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
  },
});
