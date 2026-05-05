import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
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
    <View style={[styles.wrapper, { backgroundColor: c.isDark ? "#000000" : "#FFFFFF" }]}>
      <View style={[styles.hero, { paddingTop: isWeb ? 60 : insets.top + 14 }]}>
        <View style={styles.heroRow}>
          {rightAction && (
            <TouchableOpacity
              style={[styles.actionBtn, {
                backgroundColor: accentColor + "18",
                borderColor: accentColor + "30",
              }]}
              onPress={rightAction.onPress}
              activeOpacity={0.8}
            >
              <Feather name={rightAction.icon} size={18} color={accentColor} />
            </TouchableOpacity>
          )}
          <View style={styles.heroTexts}>
            <Text style={[styles.heroTitle, { color: c.text }]}>{title}</Text>
            {subtitle && (
              <Text style={[styles.heroSub, { color: c.mutedForeground }]}>{subtitle}</Text>
            )}
          </View>
        </View>

        {onSearchChange && (
          <View style={[styles.search, {
            backgroundColor: c.isDark ? "#1C1C1E" : "#F2F2F7",
            borderColor: c.border,
          }]}>
            <Feather name="search" size={15} color={c.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: c.text }]}
              placeholder={searchPlaceholder}
              placeholderTextColor={c.mutedForeground}
              value={searchValue}
              onChangeText={onSearchChange}
              textAlign="right"
            />
            {searchValue ? (
              <TouchableOpacity onPress={() => onSearchChange?.("")}>
                <Feather name="x-circle" size={16} color={c.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>

      {filters && filters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filters, { paddingHorizontal: 16 }]}
          style={{ backgroundColor: c.isDark ? "#000000" : "#FFFFFF" }}
        >
          {filters.map((f) => {
            const active = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? accentColor : c.isDark ? "#1C1C1E" : "#F2F2F7",
                    borderColor: active ? accentColor : c.border,
                  },
                ]}
                onPress={() => onFilterChange?.(f.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, {
                  color: active ? (accentColor === AMBER ? "#000000" : "#FFFFFF") : c.mutedForeground,
                }]} >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.divider, { backgroundColor: c.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  heroRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroTexts: { flex: 1, alignItems: "flex-end" },
  heroTitle: {
    fontSize: 28,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
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
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Tajawal_400Regular",
  },
  filters: {
    flexDirection: "row-reverse",
    gap: 8,
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
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
