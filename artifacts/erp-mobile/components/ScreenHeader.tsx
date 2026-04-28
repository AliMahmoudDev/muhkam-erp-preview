import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const AMBER = "#F59E0B";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: { key: string; label: string }[];
  activeFilter?: string;
  onFilterChange?: (k: string) => void;
  rightAction?: { icon: keyof typeof Feather.glyphMap; onPress: () => void };
}

export function ScreenHeader({
  title,
  subtitle,
  accentColor = AMBER,
  searchValue,
  onSearchChange,
  searchPlaceholder = "بحث...",
  filters,
  activeFilter,
  onFilterChange,
  rightAction,
}: ScreenHeaderProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  return (
    <View>
      <LinearGradient
        colors={["#0A0E1F", "#111628"]}
        style={[styles.hero, { paddingTop: isWeb ? 64 : insets.top + 14 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.accentLine, { backgroundColor: accentColor }]} />

        <View style={styles.heroRow}>
          {rightAction && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: accentColor + "20", borderColor: accentColor + "35" }]}
              onPress={rightAction.onPress}
              activeOpacity={0.8}
            >
              <Feather name={rightAction.icon} size={18} color={accentColor} />
            </TouchableOpacity>
          )}
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>{title}</Text>
            {subtitle && <Text style={[styles.heroSub, { color: accentColor }]}>{subtitle}</Text>}
          </View>
        </View>

        {onSearchChange && (
          <View style={[styles.search, { backgroundColor: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.1)" }]}>
            <Feather name="search" size={15} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchValue}
              onChangeText={onSearchChange}
              textAlign="right"
            />
          </View>
        )}
      </LinearGradient>

      {filters && filters.length > 0 && (
        <View style={[styles.filters, { backgroundColor: c.background }]}>
          {filters.map((f) => {
            const active = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? accentColor : c.card,
                    borderColor: active ? accentColor : c.border,
                  },
                ]}
                onPress={() => onFilterChange?.(f.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, { color: active ? "#0a0500" : c.mutedForeground }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  heroRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroTexts: { flex: 1, alignItems: "flex-end" },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    color: "#F0F7FF",
    textAlign: "right",
  },
  heroSub: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    marginTop: 2,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  search: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    color: "#F0F7FF",
  },
  filters: {
    flexDirection: "row-reverse",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
  },
});
