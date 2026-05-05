import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, formatCurrency } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const AMBER = "#F59E0B";

interface DashboardStats {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalIncome: number;
  netProfit: number;
  customersCount: number;
  productsCount: number;
  lowStockCount: number;
  pendingSales: number;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <LinearGradient
      colors={[AMBER, "#D97706"]}
      style={styles.avatar}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={styles.avatarText}>{initials}</Text>
    </LinearGradient>
  );
}

const QUICK_ACTIONS = [
  { icon: "shopping-cart" as const, label: "مبيعات",   route: "/(tabs)/sales",     color: AMBER,      bg: AMBER + "18" },
  { icon: "package"       as const, label: "مخزون",    route: "/(tabs)/inventory", color: "#8B5CF6",  bg: "#8B5CF618" },
  { icon: "users"         as const, label: "عملاء",    route: "/(tabs)/customers", color: "#06B6D4",  bg: "#06B6D418" },
  { icon: "clock"         as const, label: "الحضور",   route: "/(tabs)/attendance",color: "#10B981",  bg: "#10B98118" },
  { icon: "bar-chart-2"   as const, label: "تقارير",   route: "/(tabs)/reports",   color: "#3B82F6",  bg: "#3B82F618" },
  { icon: "more-horizontal" as const, label: "المزيد", route: "/(tabs)/more",      color: "#EC4899",  bg: "#EC489918" },
];

export default function DashboardScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user, logout } = useAuth();

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [headerFade, headerSlide]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiFetch<DashboardStats>("/api/dashboard/stats"),
    staleTime: 30_000,
  });

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const isProfit = (data?.netProfit || 0) >= 0;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            backgroundColor: c.isDark ? "#000000" : "#FFFFFF",
            paddingTop: isWeb ? 60 : insets.top + 12,
            opacity: headerFade,
            transform: [{ translateY: headerSlide }],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: c.isDark ? "#1C1C1E" : "#F2F2F7", borderColor: c.border }]}
            onPress={handleLogout}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="log-out" size={15} color={c.mutedForeground} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.greeting, { color: c.mutedForeground }]}>
              {getGreeting()}، {user?.name?.split(" ")[0] || "مدير"} 👋
            </Text>
            <Text style={[styles.brandLabel, { color: c.text }]}>مُحكم ERP</Text>
          </View>

          <Avatar name={user?.name || "م"} />
        </View>

        {/* Profit pill */}
        {data && (
          <View style={[
            styles.profitPill,
            {
              backgroundColor: isProfit ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
              borderColor: isProfit ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)",
            },
          ]}>
            <Feather
              name={isProfit ? "trending-up" : "trending-down"}
              size={14}
              color={isProfit ? "#10B981" : "#EF4444"}
            />
            <Text style={[styles.profitLabel, { color: c.mutedForeground }]}>صافي الربح</Text>
            <Text style={[styles.profitValue, { color: isProfit ? "#10B981" : "#EF4444" }]}>
              {formatCurrency(data.netProfit)} ج.م
            </Text>
            <View style={[styles.profitBadge, {
              backgroundColor: isProfit ? "#10B981" : "#EF4444",
            }]}>
              <Text style={styles.profitBadgeText}>{isProfit ? "ربح" : "خسارة"}</Text>
            </View>
          </View>
        )}

        <View style={[styles.divider, { backgroundColor: c.border }]} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 34 : insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AMBER} />}
      >
        {isLoading ? (
          <ActivityIndicator color={AMBER} size="large" style={{ marginTop: 60 }} />
        ) : data ? (
          <>
            {/* Section: Stats */}
            <Text style={[styles.sectionTitle, { color: c.text }]}>ملخص الأداء</Text>
            <View style={styles.grid}>
              <StatCard title="المبيعات"   value={formatCurrency(data.totalSales)}     icon="shopping-cart" color={AMBER}      trend="up" />
              <StatCard title="المشتريات" value={formatCurrency(data.totalPurchases)}  icon="package"       color="#7C3AED" />
            </View>
            <View style={styles.grid}>
              <StatCard title="الإيرادات" value={formatCurrency(data.totalIncome)}     icon="trending-up"   color="#10B981" trend="up" />
              <StatCard title="المصروفات" value={formatCurrency(data.totalExpenses)}   icon="trending-down" color="#EF4444" trend="down" />
            </View>
            <View style={styles.grid}>
              <StatCard title="العملاء"   value={String(data.customersCount || 0)}    icon="users"         color="#06B6D4" />
              <StatCard title="المنتجات"  value={String(data.productsCount || 0)}     icon="box"           color="#8B5CF6" />
            </View>
            <View style={styles.grid}>
              <StatCard
                title="مخزون منخفض"
                value={String(data.lowStockCount || 0)}
                icon="alert-triangle"
                color={data.lowStockCount > 0 ? "#EF4444" : "#10B981"}
              />
              <StatCard title="مبيعات معلقة" value={String(data.pendingSales || 0)} icon="clock" color={AMBER} />
            </View>

            {/* Low stock alert */}
            {data.lowStockCount > 0 && (
              <TouchableOpacity
                style={[styles.alertBanner, { backgroundColor: c.isDark ? "#111111" : "#FFF5F5", borderColor: "rgba(239,68,68,0.2)" }]}
                onPress={() => router.push("/(tabs)/inventory")}
                activeOpacity={0.8}
              >
                <View style={[styles.alertIcon, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                  <Feather name="alert-triangle" size={18} color="#EF4444" />
                </View>
                <View style={styles.alertTexts}>
                  <Text style={[styles.alertTitle, { color: "#EF4444" }]}>مخزون منخفض</Text>
                  <Text style={[styles.alertSub, { color: c.mutedForeground }]}>
                    {data.lowStockCount} منتج يحتاج إعادة تخزين
                  </Text>
                </View>
                <Feather name="chevron-left" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}

            {/* Quick Actions */}
            <Text style={[styles.sectionTitle, { color: c.text }]}>إجراءات سريعة</Text>
            <View style={[styles.quickGrid, { backgroundColor: c.isDark ? "#111111" : "#FFFFFF", borderColor: c.cardBorder }]}>
              {QUICK_ACTIONS.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  style={styles.quickItem}
                  onPress={() => router.push(a.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickIcon, { backgroundColor: a.bg }]}>
                    <Feather name={a.icon} size={22} color={a.color} />
                  </View>
                  <Text style={[styles.quickLabel, { color: c.text }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingTop: 4,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { alignItems: "center", flex: 1 },
  greeting: { fontSize: 13, fontFamily: "Tajawal_400Regular", marginBottom: 2 },
  brandLabel: { fontSize: 19, fontFamily: "Tajawal_700Bold", letterSpacing: -0.3 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#000000", fontFamily: "Tajawal_700Bold", fontSize: 15 },
  profitPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  profitLabel: { flex: 1, fontSize: 13, fontFamily: "Tajawal_500Medium", textAlign: "right" },
  profitValue: { fontSize: 15, fontFamily: "Tajawal_700Bold" },
  profitBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  profitBadgeText: { fontSize: 11, fontFamily: "Tajawal_700Bold", color: "#FFFFFF" },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: -20 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
    marginTop: 4,
    marginBottom: -4,
    letterSpacing: -0.2,
  },
  grid: { flexDirection: "row-reverse", gap: 12 },
  alertBanner: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  alertIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  alertTexts: { flex: 1, alignItems: "flex-end" },
  alertTitle: { fontSize: 13, fontFamily: "Tajawal_700Bold" },
  alertSub: { fontSize: 12, fontFamily: "Tajawal_400Regular", marginTop: 2 },
  quickGrid: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    padding: 16,
    gap: 8,
  },
  quickItem: {
    alignItems: "center",
    gap: 8,
    width: "30%",
    paddingVertical: 8,
  },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  quickLabel: { fontSize: 12, fontFamily: "Tajawal_500Medium" },
});
