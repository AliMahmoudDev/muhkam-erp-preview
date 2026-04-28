import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
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
const AMBER_DARK = "#D97706";

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

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <LinearGradient
      colors={[AMBER, AMBER_DARK]}
      style={styles.avatar}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={styles.avatarText}>{initials}</Text>
    </LinearGradient>
  );
}

export default function DashboardScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user, logout } = useAuth();

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
  const profitColors: [string, string, string] = isProfit
    ? ["#065F46", "#047857", "#059669"]
    : ["#7F1D1D", "#991B1B", "#DC2626"];

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <LinearGradient
        colors={c.isDark ? ["#0A0E1F", "#0F1428", "#0A0E1F"] : ["#1a1040", "#0d1028", "#0A0E1F"]}
        style={[styles.heroGradient, { paddingTop: isWeb ? 60 : insets.top }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.heroTopRow}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={styles.logoutCircle}>
              <Feather name="log-out" size={16} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>
          <View style={styles.greetingWrap}>
            <Text style={styles.greeting}>مرحباً، {user?.name?.split(" ")[0] || "مدير"} 👋</Text>
            <Text style={styles.subGreeting}>لوحة تحكم مُحكم ERP</Text>
          </View>
          <UserAvatar name={user?.name || "م"} />
        </View>

        {data ? (
          <LinearGradient
            colors={profitColors}
            style={styles.profitCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.profitInner}>
              <View style={styles.profitIconWrap}>
                <Feather
                  name={isProfit ? "trending-up" : "trending-down"}
                  size={22}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.profitTexts}>
                <Text style={styles.profitLabel}>صافي الربح</Text>
                <Text style={styles.profitValue}>{formatCurrency(data.netProfit)} ج.م</Text>
              </View>
              <View style={[styles.profitBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Text style={styles.profitBadgeText}>{isProfit ? "ربح" : "خسارة"}</Text>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.profitCard, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <View style={styles.profitInner}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Tajawal_400Regular", fontSize: 14 }}>
                جارٍ التحميل...
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 34 : insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AMBER} />}
      >
        {isLoading ? (
          <ActivityIndicator color={AMBER} size="large" style={{ marginTop: 48 }} />
        ) : data ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: AMBER }]} />
              <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>إجمالي العمليات</Text>
            </View>
            <View style={styles.grid}>
              <StatCard title="المبيعات" value={formatCurrency(data.totalSales)} icon="shopping-cart" color={AMBER} trend="up" />
              <StatCard title="المشتريات" value={formatCurrency(data.totalPurchases)} icon="package" color="#7C3AED" />
            </View>
            <View style={styles.grid}>
              <StatCard title="الإيرادات" value={formatCurrency(data.totalIncome)} icon="trending-up" color="#10B981" trend="up" />
              <StatCard title="المصروفات" value={formatCurrency(data.totalExpenses)} icon="trending-down" color="#EF4444" trend="down" />
            </View>

            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#06B6D4" }]} />
              <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>نظرة عامة</Text>
            </View>
            <View style={styles.grid}>
              <StatCard title="العملاء" value={String(data.customersCount || 0)} icon="users" color="#06B6D4" />
              <StatCard title="المنتجات" value={String(data.productsCount || 0)} icon="box" color="#8B5CF6" />
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

            {data.lowStockCount > 0 && (
              <TouchableOpacity
                style={[styles.alertBanner, { backgroundColor: "#EF444412", borderColor: "#EF444435" }]}
                onPress={() => router.push("/(tabs)/inventory")}
                activeOpacity={0.8}
              >
                <Feather name="chevron-left" size={18} color="#EF4444" />
                <View style={styles.alertInfo}>
                  <Text style={styles.alertTitle}>تحذير: مخزون منخفض</Text>
                  <Text style={styles.alertSub}>{data.lowStockCount} منتج يحتاج إعادة تخزين</Text>
                </View>
                <View style={[styles.alertIconWrap, { backgroundColor: "#EF444420" }]}>
                  <Feather name="alert-triangle" size={20} color="#EF4444" />
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#10B981" }]} />
              <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>إجراءات سريعة</Text>
            </View>
            <View style={[styles.quickGrid, { borderColor: c.cardBorder }]}>
              <LinearGradient
                colors={c.isDark ? ["#1C2340", "#141828"] : ["#FFFFFF", "#F8FAFC"]}
                style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
              />
              {[
                { icon: "shopping-cart" as const, label: "مبيعات", route: "/(tabs)/sales", color: AMBER, bg: AMBER + "18" },
                { icon: "package" as const, label: "مخزون", route: "/(tabs)/inventory", color: "#8B5CF6", bg: "#8B5CF618" },
                { icon: "users" as const, label: "عملاء", route: "/(tabs)/customers", color: "#06B6D4", bg: "#06B6D418" },
                { icon: "more-horizontal" as const, label: "المزيد", route: "/(tabs)/more", color: "#10B981", bg: "#10B98118" },
              ].map((a) => (
                <TouchableOpacity
                  key={a.label}
                  style={styles.quickItem}
                  onPress={() => router.push(a.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickIcon, { backgroundColor: a.bg, borderColor: a.color + "30" }]}>
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
  heroGradient: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingTop: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#0A0500",
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },
  greetingWrap: { alignItems: "center", flex: 1 },
  greeting: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: "#F0F7FF",
    textAlign: "center",
  },
  subGreeting: {
    fontSize: 11,
    color: AMBER,
    fontFamily: "Tajawal_400Regular",
    marginTop: 2,
  },
  logoutBtn: { padding: 4 },
  logoutCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  profitCard: {
    borderRadius: 20,
    overflow: "hidden",
  },
  profitInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  profitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  profitTexts: { flex: 1, alignItems: "flex-end" },
  profitLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Tajawal_400Regular",
    marginBottom: 3,
  },
  profitValue: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  profitBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  profitBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    color: "#FFFFFF",
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: -4,
  },
  sectionDot: { width: 3, height: 14, borderRadius: 2 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
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
  alertIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  alertInfo: { flex: 1, alignItems: "flex-end" },
  alertTitle: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
    color: "#EF4444",
    textAlign: "right",
  },
  alertSub: {
    fontSize: 11,
    fontFamily: "Tajawal_400Regular",
    color: "#EF4444",
    textAlign: "right",
    marginTop: 2,
    opacity: 0.8,
  },
  quickGrid: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 20,
    position: "relative",
  },
  quickItem: { alignItems: "center", gap: 10 },
  quickIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  quickLabel: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
  },
});
