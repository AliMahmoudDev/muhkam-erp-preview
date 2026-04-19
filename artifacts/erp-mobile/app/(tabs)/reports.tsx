import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { apiFetch, formatCurrency } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const AMBER = "#F59E0B";

interface ProductProfitSummary {
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  overall_margin: number;
}
interface ProductProfitResponse {
  summary: ProductProfitSummary;
  products: Array<{ product_id: number; product_name: string; qty_sold: number; revenue: number; profit: number; profit_margin: number }>;
}

interface TopResponse {
  top_products: Array<{ product_id: number; product_name: string; total_qty: number; total_revenue: number; total_profit: number }>;
}

interface SalesAnalysis {
  by_customer: Array<{ customer_id: number | null; customer_name: string; total_revenue: number; invoice_count: number }>;
}

interface LowStock {
  id: number;
  name: string;
  quantity: number;
  min_stock: number;
}

type Period = "daily" | "weekly" | "monthly";

function fmt(n: number) { return formatCurrency(n) + " ج.م"; }

function StatRow({ label, value, color = "#fff" }: { label: string; value: string; color?: string }) {
  const c = useColors();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, icon, children, accentColor = AMBER }: { title: string; icon: keyof typeof Feather.glyphMap; children: React.ReactNode; accentColor?: string }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.cardHeader, { borderBottomColor: c.border }]}>
        <Feather name={icon} size={16} color={accentColor} />
        <Text style={[styles.cardTitle, { color: c.foreground }]}>{title}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export default function ReportsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [period, setPeriod] = useState<Period>("monthly");

  const now = new Date();
  function getRange(p: Period): { from: string; to: string } {
    const to = now.toISOString().split("T")[0];
    let from: Date;
    if (p === "daily") { from = new Date(now); from.setDate(from.getDate() - 1); }
    else if (p === "weekly") { from = new Date(now); from.setDate(from.getDate() - 7); }
    else { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    return { from: from.toISOString().split("T")[0], to };
  }

  const { from, to } = getRange(period);
  const qParams = `date_from=${from}&date_to=${to}`;

  const profitQ = useQuery<ProductProfitResponse>({
    queryKey: ["mob-product-profit", period],
    queryFn: () => apiFetch(`/api/reports/product-profit?${qParams}`),
    staleTime: 60_000,
  });

  const topQ = useQuery<TopResponse>({
    queryKey: ["mob-top", period],
    queryFn: () => apiFetch(`/api/reports/top?${qParams}&limit=5`),
    staleTime: 60_000,
  });

  const salesQ = useQuery<SalesAnalysis>({
    queryKey: ["mob-sales-analysis", period],
    queryFn: () => apiFetch(`/api/reports/sales-analysis?${qParams}`),
    staleTime: 60_000,
  });

  const lowQ = useQuery<LowStock[]>({
    queryKey: ["mob-low-stock"],
    queryFn: () => apiFetch(`/api/inventory/low-stock`),
    staleTime: 60_000,
  });

  const isLoading = profitQ.isLoading || topQ.isLoading;
  const isRefetching = profitQ.isRefetching || topQ.isRefetching;
  const refetch = () => { profitQ.refetch(); topQ.refetch(); salesQ.refetch(); lowQ.refetch(); };

  const PERIODS: { key: Period; label: string }[] = [
    { key: "daily", label: "يوم" },
    { key: "weekly", label: "أسبوع" },
    { key: "monthly", label: "شهر" },
  ];

  const sm = profitQ.data?.summary;
  const isProfit = (sm?.total_profit ?? 0) >= 0;
  const totalSales = salesQ.data?.by_customer.reduce((s, r) => s + r.total_revenue, 0) ?? 0;
  const totalInvoices = salesQ.data?.by_customer.reduce((s, r) => s + r.invoice_count, 0) ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* ─── هيدر ─── */}
      <View style={[styles.header, { backgroundColor: c.headerBg, paddingTop: isWeb ? 67 : insets.top + 12 }]}>
        <View style={styles.headerGoldLine} />
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>التقارير</Text>
            <Text style={styles.subtitle}>نظرة سريعة على أداء المبيعات</Text>
          </View>
          <Feather name="bar-chart-2" size={22} color={AMBER} />
        </View>

        {/* فلتر الفترة */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodLabel, { color: period === p.key ? "#000" : c.mutedForeground }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={AMBER} size="large" />
          <Text style={[styles.loadingText, { color: c.mutedForeground }]}>جاري التحميل...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AMBER} />}
        >
          {/* ─── صافي الربح ─── */}
          {sm && (
            <View style={[styles.profitBanner, { borderColor: isProfit ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)", backgroundColor: isProfit ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)" }]}>
              <Feather name={isProfit ? "trending-up" : "trending-down"} size={22} color={isProfit ? "#10B981" : "#EF4444"} />
              <View style={styles.profitText}>
                <Text style={[styles.profitValue, { color: isProfit ? "#10B981" : "#EF4444" }]}>{fmt(sm.total_profit)}</Text>
                <Text style={[styles.profitSub, { color: c.mutedForeground }]}>مجمل الربح للفترة ({sm.overall_margin.toFixed(1)}%)</Text>
              </View>
            </View>
          )}

          {/* ─── ملخص المبيعات ─── */}
          <SectionCard title="ملخص المبيعات" icon="shopping-cart">
            {salesQ.isLoading ? (
              <ActivityIndicator color={AMBER} />
            ) : (
              <>
                <StatRow label="إجمالي المبيعات" value={fmt(totalSales)} color={AMBER} />
                <StatRow label="عدد الفواتير" value={String(totalInvoices)} />
              </>
            )}
          </SectionCard>

          {/* ─── ملخص الربح والتكلفة ─── */}
          {sm && (
            <SectionCard title="ربحية الأصناف" icon="activity" accentColor={isProfit ? "#10B981" : "#EF4444"}>
              <StatRow label="إجمالي الإيرادات" value={fmt(sm.total_revenue)} color={AMBER} />
              <StatRow label="تكلفة البضاعة (COGS)" value={fmt(sm.total_cogs)} color="#EF4444" />
              <View style={styles.divider} />
              <StatRow label="مجمل الربح" value={fmt(sm.total_profit)} color={isProfit ? "#10B981" : "#EF4444"} />
              <StatRow label="هامش الربح" value={`${sm.overall_margin.toFixed(1)}%`} color={isProfit ? "#10B981" : "#EF4444"} />
            </SectionCard>
          )}

          {/* ─── أكثر المنتجات مبيعاً ─── */}
          <SectionCard title="أكثر المنتجات مبيعاً" icon="package" accentColor="#818CF8">
            {topQ.isLoading ? (
              <ActivityIndicator color={AMBER} style={{ margin: 12 }} />
            ) : !topQ.data?.top_products?.length ? (
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>لا توجد بيانات مبيعات</Text>
            ) : (
              topQ.data.top_products.map((p, idx) => (
                <View key={p.product_id} style={styles.topRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.topName, { color: c.foreground }]} numberOfLines={1}>{p.product_name}</Text>
                    <Text style={[styles.topSub, { color: c.mutedForeground }]}>{p.total_qty} وحدة</Text>
                  </View>
                  <View style={styles.topRight}>
                    <Text style={[styles.topAmount, { color: AMBER }]}>{fmt(p.total_revenue)}</Text>
                    <Text style={[styles.topRank, { color: c.mutedForeground }]}>#{idx + 1}</Text>
                  </View>
                </View>
              ))
            )}
          </SectionCard>

          {/* ─── المنتجات قليلة المخزون ─── */}
          <SectionCard title="تحذيرات المخزون" icon="alert-triangle" accentColor="#F97316">
            {lowQ.isLoading ? (
              <ActivityIndicator color={AMBER} style={{ margin: 12 }} />
            ) : !lowQ.data?.length ? (
              <View style={styles.okRow}>
                <Feather name="check-circle" size={16} color="#10B981" />
                <Text style={[styles.okText, { color: "#10B981" }]}>المخزون بحالة جيدة</Text>
              </View>
            ) : (
              lowQ.data.slice(0, 8).map(p => (
                <View key={p.id} style={styles.topRow}>
                  <Text style={[styles.topName, { color: c.foreground }]} numberOfLines={1}>{p.name}</Text>
                  <View style={styles.stockBadge}>
                    <Text style={styles.stockQty}>{p.quantity}</Text>
                  </View>
                </View>
              ))
            )}
          </SectionCard>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(245,158,11,0.2)",
  },
  headerGoldLine: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 2, backgroundColor: "rgba(245,158,11,0.45)",
  },
  headerRow: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
  },
  headerTextWrap: { alignItems: "flex-end" },
  title: { fontFamily: "Tajawal_700Bold", fontSize: 22, color: "#fff" },
  subtitle: { fontFamily: "Tajawal_400Regular", fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 2 },
  periodRow: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  periodBtnActive: { backgroundColor: AMBER, borderColor: AMBER },
  periodLabel: { fontFamily: "Tajawal_700Bold", fontSize: 13 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: "Tajawal_400Regular", fontSize: 14 },
  scroll: { flex: 1 },
  profitBanner: {
    flexDirection: "row-reverse", alignItems: "center", gap: 14,
    margin: 16, padding: 16, borderRadius: 16, borderWidth: 1,
  },
  profitText: { alignItems: "flex-end", flex: 1 },
  profitValue: { fontFamily: "Tajawal_700Bold", fontSize: 24 },
  profitSub: { fontFamily: "Tajawal_400Regular", fontSize: 12, marginTop: 2 },
  card: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    padding: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: { fontFamily: "Tajawal_700Bold", fontSize: 15 },
  cardBody: { padding: 14, gap: 10 },
  statRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontFamily: "Tajawal_400Regular", fontSize: 13 },
  statValue: { fontFamily: "Tajawal_700Bold", fontSize: 15 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 4 },
  emptyText: { fontFamily: "Tajawal_400Regular", fontSize: 13, textAlign: "center", paddingVertical: 8 },
  topRow: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  topName: { fontFamily: "Tajawal_500Medium", fontSize: 14 },
  topSub: { fontFamily: "Tajawal_400Regular", fontSize: 11, marginTop: 2 },
  topRight: { alignItems: "flex-start" },
  topAmount: { fontFamily: "Tajawal_700Bold", fontSize: 13 },
  topRank: { fontFamily: "Tajawal_400Regular", fontSize: 11, marginTop: 1 },
  okRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 4 },
  okText: { fontFamily: "Tajawal_500Medium", fontSize: 13 },
  stockBadge: {
    backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
  },
  stockQty: { fontFamily: "Tajawal_700Bold", fontSize: 13, color: "#EF4444" },
});
