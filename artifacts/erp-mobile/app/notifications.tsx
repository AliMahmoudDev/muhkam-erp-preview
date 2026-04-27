import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { useColors } from "@/hooks/useColors";
import { apiFetch, formatDate } from "@/lib/api";

const AMBER = "#F59E0B";
const BLUE = "#06B6D4";

interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    warning:  "#EF4444",
    success:  "#10B981",
    info:     BLUE,
    low_stock: "#EF4444",
    payment:  AMBER,
  };
  return map[type] ?? AMBER;
}

function typeIcon(type: string): keyof typeof Feather.glyphMap {
  const map: Record<string, keyof typeof Feather.glyphMap> = {
    warning:   "alert-triangle",
    success:   "check-circle",
    info:      "info",
    low_stock: "package",
    payment:   "dollar-sign",
  };
  return map[type] ?? "bell";
}

function NotificationItem({ item, onRead }: { item: Notification; onRead: (id: number) => void }) {
  const c = useColors();
  const color = typeColor(item.type);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: item.is_read ? c.card : c.card,
          borderColor: item.is_read ? c.cardBorder : color + "40",
          opacity: item.is_read ? 0.7 : 1,
        },
      ]}
      onPress={() => { if (!item.is_read) onRead(item.id); }}
      activeOpacity={0.8}
    >
      <View style={[styles.cardTopLine, { backgroundColor: item.is_read ? c.border : color }]} />

      <View style={styles.cardBody}>
        <View style={[styles.iconWrap, { backgroundColor: color + "1A" }]}>
          <Feather name={typeIcon(item.type)} size={20} color={color} />
        </View>

        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
            <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
          <Text style={[styles.body, { color: c.mutedForeground }]} numberOfLines={3}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: c.mutedForeground }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Notification[]>("/api/notifications"),
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = (data || []).filter((n) => !n.is_read).length;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* ── الهيدر ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: c.headerBg, paddingTop: isWeb ? 67 : insets.top + 12 },
        ]}
      >
        <View style={styles.headerLine} />
        <View style={styles.headerRow}>
          {unreadCount > 0 ? (
            <TouchableOpacity
              style={[styles.markAllBtn, { backgroundColor: AMBER + "1A", borderColor: AMBER + "40" }]}
              onPress={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <Text style={[styles.markAllText, { color: AMBER }]}>
                {markAllRead.isPending ? "..." : "قراءة الكل"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.markAllBtn} />
          )}

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>الإشعارات</Text>
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: AMBER }]}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSub}>
          {data ? `${data.length} إشعار` : ""}
          {unreadCount > 0 ? ` · ${unreadCount} غير مقروء` : ""}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={AMBER} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <NotificationItem item={item} onRead={(id) => markRead.mutate(id)} />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 40 },
            !(data || []).length && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AMBER} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title="لا توجد إشعارات"
              subtitle="ستظهر هنا إشعارات النظام والتنبيهات"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 12, paddingHorizontal: 20, position: "relative" },
  headerLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: AMBER,
  },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerTitleWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    color: "#F0F7FF",
    textAlign: "right",
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
    color: "#0a0500",
  },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
  },
  backBtn: { padding: 4 },
  markAllBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  cardBody: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    paddingTop: 18,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  textWrap: { flex: 1, alignItems: "flex-end" },
  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
    flexShrink: 1,
  },
  body: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    lineHeight: 20,
    marginBottom: 6,
  },
  time: {
    fontSize: 11,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
  },
});
