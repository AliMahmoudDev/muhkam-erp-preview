import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme, type ThemeMode } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, formatCurrency } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const AMBER = "#F59E0B";

interface Safe { id: number; name: string; balance: number; }
interface Expense { id: number; amount: number; }

function ThemeSwitcher() {
  const c = useColors();
  const { mode, setMode } = useTheme();

  const options: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "light",  label: "فاتح",   icon: "sun" },
    { key: "system", label: "تلقائي", icon: "smartphone" },
    { key: "dark",   label: "داكن",   icon: "moon" },
  ];

  return (
    <View style={[styles.themeSwitcher, {
      backgroundColor: c.isDark ? "#0A0A0A" : "#F2F2F7",
      borderColor: c.border,
    }]}>
      {options.map((opt) => {
        const active = mode === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.themeOption,
              active && {
                backgroundColor: c.isDark ? "#1C1C1E" : "#FFFFFF",
                shadowColor: AMBER,
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 3,
              },
            ]}
            onPress={() => setMode(opt.key)}
            activeOpacity={0.7}
          >
            <Feather name={opt.icon} size={15} color={active ? AMBER : c.mutedForeground} />
            <Text style={[styles.themeLabel, { color: active ? AMBER : c.mutedForeground }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SectionHeader({ title, color }: { title: string; color?: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={[styles.sectionAccent, { backgroundColor: color || AMBER }]} />
      <Text style={styles.sectionLabel}>{title}</Text>
    </View>
  );
}

function MenuRow({
  icon, label, value, color, onPress, last, badge,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  color?: string;
  onPress?: () => void;
  last?: boolean;
  badge?: string;
}) {
  const c = useColors();
  const col = color || AMBER;
  return (
    <TouchableOpacity
      style={[
        styles.menuRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Feather name="chevron-left" size={15} color={c.mutedForeground} />
      {value && <Text style={[styles.menuValue, { color: col }]}>{value}</Text>}
      {badge && (
        <View style={[styles.badgePill, { backgroundColor: col + "18" }]}>
          <Text style={[styles.badgePillText, { color: col }]}>{badge}</Text>
        </View>
      )}
      <Text style={[styles.menuLabel, { color: c.text }]}>{label}</Text>
      <View style={[styles.menuIcon, { backgroundColor: col + "15" }]}>
        <Feather name={icon} size={15} color={col} />
      </View>
    </TouchableOpacity>
  );
}

function SectionCard({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.section}>
      <SectionHeader title={title} color={color} />
      <View style={[styles.sectionCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        {children}
      </View>
    </View>
  );
}

function PurchasesMenuItem() {
  const c = useColors();
  return (
    <View style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <View style={styles.purchaseActions}>
        <TouchableOpacity
          style={[styles.purchaseBtn, { backgroundColor: "#7C3AED15", borderColor: "#7C3AED28" }]}
          onPress={() => router.push("/new-purchase")}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={12} color="#7C3AED" />
          <Text style={[styles.purchaseBtnText, { color: "#7C3AED" }]}>فاتورة جديدة</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.purchaseBtn, { backgroundColor: "#7C3AED15", borderColor: "#7C3AED28" }]}
          onPress={() => router.push("/purchases")}
          activeOpacity={0.7}
        >
          <Feather name="list" size={12} color="#7C3AED" />
          <Text style={[styles.purchaseBtnText, { color: "#7C3AED" }]}>عرض الكل</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.menuLabel, { color: c.text }]}>المشتريات</Text>
      <View style={[styles.menuIcon, { backgroundColor: "#7C3AED15" }]}>
        <Feather name="shopping-bag" size={15} color="#7C3AED" />
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user, logout } = useAuth();

  const { data: safes = [] } = useQuery({
    queryKey: ["safes"],
    queryFn: () => apiFetch<Safe[]>("/api/settings/safes"),
    staleTime: 60_000,
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => apiFetch<Expense[]>("/api/expenses"),
    staleTime: 60_000,
  });

  const totalSafesBalance = safes.reduce((a, s) => a + Number(s.balance), 0);
  const totalExpenses = (expenses || []).reduce((a, e) => a + Number(e.amount), 0);

  const roleLabel =
    user?.role === "super_admin" ? "مدير النظام" :
    user?.role === "admin" ? "مدير" :
    user?.role === "manager" ? "مشرف" :
    user?.role === "salesperson" ? "مندوب مبيعات" :
    "كاشير";

  const nameInitials = (user?.name || "م")
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "خروج", style: "destructive",
        onPress: async () => { await logout(); router.replace("/login"); },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 34 : insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner */}
        <LinearGradient
          colors={["#0A0A0A", "#111111", "#000000"]}
          style={[styles.heroBanner, { paddingTop: isWeb ? 60 : insets.top + 20 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Decorative dots */}
          <View style={styles.heroDots} pointerEvents="none">
            {[...Array(5)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { left: `${8 + i * 18}%` as any, top: `${15 + (i % 3) * 28}%` as any, opacity: 0.2 + (i % 3) * 0.12 }
                ]}
              />
            ))}
          </View>

          {/* User info */}
          <View style={styles.heroContent}>
            <LinearGradient
              colors={[AMBER, "#D97706"]}
              style={styles.heroAvatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.heroAvatarText}>{nameInitials}</Text>
            </LinearGradient>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{user?.name}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
              </View>
              <Text style={styles.heroUsername}>@{user?.username}</Text>
            </View>

            <View style={styles.heroLogoWrap}>
              <Image
                source={require("@/assets/images/muhkam-logo.png")}
                style={styles.heroLogo}
                contentFit="contain"
              />
            </View>
          </View>

          {/* Stats */}
          <View style={styles.heroStats}>
            <View style={[styles.heroStat, { backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)" }]}>
              <Text style={[styles.heroStatVal, { color: totalSafesBalance >= 0 ? "#10B981" : "#EF4444" }]}>
                {formatCurrency(totalSafesBalance)} ج.م
              </Text>
              <Text style={styles.heroStatLabel}>الخزائن</Text>
            </View>
            <View style={[styles.heroStat, { backgroundColor: "rgba(249,115,22,0.08)", borderColor: "rgba(249,115,22,0.2)" }]}>
              <Text style={[styles.heroStatVal, { color: "#F97316" }]}>
                {formatCurrency(totalExpenses)} ج.م
              </Text>
              <Text style={styles.heroStatLabel}>المصروفات</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <SectionCard title="مظهر التطبيق" color="#7C3AED">
            <View style={styles.themePad}>
              <Text style={[styles.themeHint, { color: c.mutedForeground }]}>
                اختر بين الوضع الفاتح والداكن
              </Text>
              <ThemeSwitcher />
            </View>
          </SectionCard>

          <SectionCard title="الخزائن">
            {safes.length === 0 ? (
              <MenuRow icon="database" label="لا توجد خزائن مُعرَّفة" color="#EF4444" last />
            ) : (
              safes.map((s, idx) => (
                <MenuRow
                  key={s.id}
                  icon="dollar-sign"
                  label={s.name}
                  value={`${formatCurrency(Number(s.balance))} ج.م`}
                  color={Number(s.balance) >= 0 ? "#10B981" : "#EF4444"}
                  last={idx === safes.length - 1}
                />
              ))
            )}
            {safes.length > 1 && (
              <MenuRow
                icon="layers"
                label="الإجمالي الكلي"
                value={`${formatCurrency(totalSafesBalance)} ج.م`}
                color={totalSafesBalance >= 0 ? AMBER : "#EF4444"}
                last
              />
            )}
          </SectionCard>

          <SectionCard title="العمليات">
            <PurchasesMenuItem />
            <MenuRow
              icon="credit-card"
              label="المصروفات"
              value={`${formatCurrency(totalExpenses)} ج.م`}
              onPress={() => router.push("/expenses")}
              color={AMBER}
            />
            <MenuRow
              icon="bar-chart-2"
              label="التقارير"
              badge="عرض"
              onPress={() => router.push("/reports")}
              color="#06B6D4"
              last
            />
          </SectionCard>

          <SectionCard title="الإشعارات" color={AMBER}>
            <MenuRow
              icon="bell"
              label="مركز الإشعارات"
              onPress={() => router.push("/notifications")}
              color={AMBER}
              last
            />
          </SectionCard>

          <SectionCard title="الإعدادات" color="#10B981">
            <MenuRow
              icon="settings"
              label="إعدادات النظام"
              onPress={() => router.push("/settings")}
              color="#10B981"
              last
            />
          </SectionCard>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <View style={[styles.logoutInner, { backgroundColor: "#EF44441A", borderColor: "rgba(239,68,68,0.2)" }]}>
              <Feather name="log-out" size={17} color="#EF4444" />
              <Text style={styles.logoutText}>تسجيل الخروج</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.version, { color: c.mutedForeground }]}>مُحكم ERP v2.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 0 },
  heroBanner: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    overflow: "hidden",
    position: "relative",
  },
  heroDots: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  dot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: AMBER,
  },
  heroContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  heroAvatarText: { color: "#000000", fontFamily: "Tajawal_700Bold", fontSize: 21 },
  heroInfo: { flex: 1, alignItems: "flex-end", gap: 5 },
  heroName: { fontSize: 19, fontFamily: "Tajawal_700Bold", color: "#FFFFFF", textAlign: "right" },
  roleBadge: {
    backgroundColor: "rgba(245,158,11,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
  },
  roleBadgeText: { fontSize: 11, fontFamily: "Tajawal_700Bold", color: AMBER },
  heroUsername: { fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "Tajawal_400Regular" },
  heroLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroLogo: { width: 34, height: 34 },
  heroStats: { flexDirection: "row-reverse", gap: 10 },
  heroStat: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-end",
  },
  heroStatVal: { fontSize: 14, fontFamily: "Tajawal_700Bold", marginBottom: 3 },
  heroStatLabel: { fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "Tajawal_400Regular" },

  body: { padding: 16, gap: 4 },
  section: { marginBottom: 14 },
  sectionHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingRight: 2,
  },
  sectionAccent: { width: 3, height: 15, borderRadius: 2 },
  sectionLabel: { fontSize: 12, fontFamily: "Tajawal_500Medium", color: "#8E8E93" },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },

  menuRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: { flex: 1, fontSize: 14, fontFamily: "Tajawal_500Medium", textAlign: "right" },
  menuValue: { fontSize: 13, fontFamily: "Tajawal_700Bold" },
  badgePill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  badgePillText: { fontSize: 11, fontFamily: "Tajawal_700Bold" },

  themePad: { padding: 14, gap: 10 },
  themeHint: { fontSize: 12, fontFamily: "Tajawal_400Regular", textAlign: "center" },
  themeSwitcher: {
    flexDirection: "row-reverse",
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  themeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 10,
    paddingVertical: 10,
  },
  themeLabel: { fontSize: 12, fontFamily: "Tajawal_700Bold" },

  purchaseActions: { flexDirection: "row-reverse", gap: 6 },
  purchaseBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  purchaseBtnText: { fontSize: 11, fontFamily: "Tajawal_700Bold" },

  logoutBtn: { borderRadius: 16, overflow: "hidden", marginTop: 8, marginBottom: 4 },
  logoutInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontFamily: "Tajawal_700Bold", color: "#EF4444" },
  version: {
    fontSize: 11,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
});
