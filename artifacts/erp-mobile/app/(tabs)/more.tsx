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
const AMBER_DARK = "#D97706";

interface Safe { id: number; name: string; balance: number; }
interface Expense { id: number; amount: number; }

function ThemeSwitcher() {
  const c = useColors();
  const { mode, isDark, setMode } = useTheme();

  const options: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "light",  label: "فاتح",   icon: "sun" },
    { key: "system", label: "تلقائي", icon: "smartphone" },
    { key: "dark",   label: "داكن",   icon: "moon" },
  ];

  return (
    <View style={[styles.themeSwitcher, { backgroundColor: c.muted, borderColor: c.border }]}>
      {options.map((opt) => {
        const active = mode === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.themeOption,
              active && {
                backgroundColor: isDark ? "#1C2340" : "#FFFFFF",
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
      <View style={[styles.sectionDot, { backgroundColor: color || AMBER }]} />
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
        <View style={[styles.badge, { backgroundColor: col + "20" }]}>
          <Text style={[styles.badgeText, { color: col }]}>{badge}</Text>
        </View>
      )}
      <Text style={[styles.menuLabel, { color: c.text }]}>{label}</Text>
      <View style={[styles.menuIcon, { backgroundColor: col + "18", borderColor: col + "28" }]}>
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
          style={[styles.purchaseBtn, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED30" }]}
          onPress={() => router.push("/new-purchase")}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={12} color="#7C3AED" />
          <Text style={[styles.purchaseBtnText, { color: "#7C3AED" }]}>فاتورة جديدة</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.purchaseBtn, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED30" }]}
          onPress={() => router.push("/purchases")}
          activeOpacity={0.7}
        >
          <Feather name="list" size={12} color="#7C3AED" />
          <Text style={[styles.purchaseBtnText, { color: "#7C3AED" }]}>عرض الكل</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.menuLabel, { color: c.text }]}>المشتريات</Text>
      <View style={[styles.menuIcon, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED28" }]}>
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
        <LinearGradient
          colors={["#0A0E1F", "#1A1040", "#0D1028"]}
          style={[styles.heroBanner, { paddingTop: isWeb ? 60 : insets.top + 16 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroStars}>
            {[...Array(6)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.star,
                  { left: `${10 + i * 15}%` as any, top: `${20 + (i % 3) * 25}%` as any, opacity: 0.3 + (i % 3) * 0.15 }
                ]}
              />
            ))}
          </View>

          <View style={styles.heroContent}>
            <LinearGradient
              colors={[AMBER, AMBER_DARK]}
              style={styles.heroAvatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.heroAvatarText}>{nameInitials}</Text>
            </LinearGradient>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{user?.name}</Text>
              <View style={[styles.roleBadge, { backgroundColor: AMBER + "25", borderColor: AMBER + "40" }]}>
                <Text style={[styles.roleBadgeText, { color: AMBER }]}>{roleLabel}</Text>
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

          <View style={styles.heroStats}>
            {[
              { label: "الخزائن", value: `${formatCurrency(totalSafesBalance)} ج.م`, color: totalSafesBalance >= 0 ? "#10B981" : "#EF4444" },
              { label: "المصروفات", value: `${formatCurrency(totalExpenses)} ج.م`, color: "#F97316" },
            ].map((s) => (
              <View key={s.label} style={[styles.heroStat, { backgroundColor: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.1)" }]}>
                <Text style={[styles.heroStatVal, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.heroStatLabel}>{s.label}</Text>
              </View>
            ))}
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
            <LinearGradient
              colors={["#7F1D1D", "#991B1B"]}
              style={styles.logoutGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Feather name="log-out" size={18} color="#FFFFFF" />
              <Text style={styles.logoutText}>تسجيل الخروج</Text>
            </LinearGradient>
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
  heroStars: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  star: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: AMBER,
  },
  heroContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  heroAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
  },
  heroAvatarText: {
    color: "#0A0500",
    fontFamily: "Tajawal_700Bold",
    fontSize: 20,
  },
  heroInfo: { flex: 1, alignItems: "flex-end", gap: 5 },
  heroName: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: "#F0F7FF",
    textAlign: "right",
  },
  roleBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
  },
  heroUsername: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Tajawal_400Regular",
  },
  heroLogoWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroLogo: { width: 32, height: 32 },
  heroStats: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  heroStat: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "flex-end",
  },
  heroStatVal: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 2,
  },
  heroStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Tajawal_400Regular",
  },
  body: { padding: 16, gap: 4 },
  section: { marginBottom: 14 },
  sectionHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
    paddingRight: 2,
  },
  sectionDot: { width: 3, height: 14, borderRadius: 2 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    color: "#94A3B8",
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
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
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
  menuValue: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
  },
  themePad: { padding: 14, gap: 10 },
  themeHint: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
  },
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
  themeLabel: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  purchaseActions: {
    flexDirection: "row-reverse",
    gap: 6,
  },
  purchaseBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  purchaseBtnText: {
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
  },
  logoutBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 4,
  },
  logoutGradient: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#FFFFFF",
  },
  version: {
    fontSize: 11,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
});
