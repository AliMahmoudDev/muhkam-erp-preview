import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { useColors } from "@/hooks/useColors";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";

const AMBER = "#F59E0B";

interface Sale {
  id: number;
  invoice_no: string;
  customer_name: string | null;
  payment_type: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  date: string | null;
  created_at: string;
}

const STATUS: Record<string, { label: string; color: string }> = {
  paid:    { label: "مدفوع",       color: "#10B981" },
  partial: { label: "جزئي",        color: AMBER },
  unpaid:  { label: "غير مدفوع",   color: "#EF4444" },
};

const PAYMENT: Record<string, string> = {
  cash: "نقدي", credit: "آجل", partial: "جزئي",
};

function SaleCard({ item }: { item: Sale }) {
  const c = useColors();
  const st = STATUS[item.status] || { label: item.status, color: c.mutedForeground };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderLeftColor: st.color }]}
      onPress={() => router.push({ pathname: "/sale-details", params: { id: String(item.id) } })}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: st.color + "18" }]}>
          <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
        </View>
        <View style={styles.invoiceRow}>
          <Text style={[styles.date, { color: c.mutedForeground }]}>{formatDate(item.date || item.created_at)}</Text>
          <Text style={[styles.invoice, { color: AMBER }]}>#{item.invoice_no}</Text>
        </View>
      </View>

      <Text style={[styles.customer, { color: c.text }]}>{item.customer_name || "عميل نقدي"}</Text>

      <View style={[styles.divider, { backgroundColor: c.border }]} />

      <View style={styles.amountRow}>
        <View style={[styles.paymentType, { backgroundColor: AMBER + "15" }]}>
          <Text style={[styles.paymentText, { color: AMBER }]}>{PAYMENT[item.payment_type] || item.payment_type}</Text>
        </View>
        <View style={styles.amounts}>
          <View style={styles.amountCol}>
            <Text style={[styles.amtLabel, { color: c.mutedForeground }]}>المتبقي</Text>
            <Text style={[styles.amtVal, { color: item.remaining_amount > 0 ? "#EF4444" : "#10B981" }]}>
              {formatCurrency(item.remaining_amount)}
            </Text>
          </View>
          <View style={[styles.amtSep, { backgroundColor: c.border }]} />
          <View style={styles.amountCol}>
            <Text style={[styles.amtLabel, { color: c.mutedForeground }]}>الإجمالي</Text>
            <Text style={[styles.amtVal, { color: c.text }]}>{formatCurrency(item.total_amount)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const FILTER_OPTIONS = [
  { key: "all",     label: "الكل"        },
  { key: "paid",    label: "مدفوع"       },
  { key: "partial", label: "جزئي"        },
  { key: "unpaid",  label: "غير مدفوع"  },
] as const;

export default function SalesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"paid"|"partial"|"unpaid">("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["sales"],
    queryFn: () => apiFetch<Sale[]>("/api/sales"),
    staleTime: 30_000,
  });

  const filtered = (data || []).filter((s) => {
    const matchSearch = !search || s.invoice_no.includes(search) || (s.customer_name || "").includes(search);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredTotal  = filtered.reduce((sum, s) => sum + s.total_amount, 0);
  const filteredUnpaid = filtered.reduce((sum, s) => sum + s.remaining_amount, 0);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: c.isDark ? "#000000" : "#FFFFFF",
        paddingTop: isWeb ? 64 : insets.top + 14,
        borderBottomColor: c.border,
      }]}>
        {/* amber top line */}
        <View style={styles.headerAccentLine} />

        <View style={styles.headerRow}>
          <View style={styles.headerStats}>
            <Text style={[styles.headerStatVal, { color: filteredUnpaid > 0 ? "#EF4444" : "#10B981" }]}>
              {formatCurrency(filteredUnpaid)}
            </Text>
            <Text style={[styles.headerStatLbl, { color: c.mutedForeground }]}>متبقي ج.م</Text>
          </View>
          <Text style={[styles.headerTitle, { color: c.text }]}>المبيعات</Text>
          <View style={styles.headerStats}>
            <Text style={[styles.headerStatVal, { color: AMBER }]}>{formatCurrency(filteredTotal)}</Text>
            <Text style={[styles.headerStatLbl, { color: c.mutedForeground }]}>إجمالي ج.م</Text>
          </View>
        </View>

        <Text style={[styles.headerSub, { color: c.mutedForeground }]}>
          {filtered.length} فاتورة{data && data.length !== filtered.length ? ` من ${data.length}` : ""}
        </Text>

        <View style={[styles.searchBox, { backgroundColor: c.isDark ? "#1C1C1E" : "#F2F2F7", borderColor: c.border }]}>
          <Feather name="search" size={15} color={c.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="بحث برقم الفاتورة أو العميل..."
            placeholderTextColor={c.mutedForeground}
            value={search}
            onChangeText={setSearch}
            textAlign="right"
          />
          {search ? <Feather name="x-circle" size={16} color={c.mutedForeground} onPress={() => setSearch("")} /> : null}
        </View>
      </View>

      {/* Filter chips */}
      <View style={[styles.statusFilters, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        {FILTER_OPTIONS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.statusChip, {
              backgroundColor: statusFilter === f.key ? (STATUS[f.key]?.color ?? AMBER) : c.isDark ? "#1C1C1E" : "#F2F2F7",
              borderColor: statusFilter === f.key ? (STATUS[f.key]?.color ?? AMBER) : c.border,
            }]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[styles.statusChipText, {
              color: statusFilter === f.key ? "#fff" : c.mutedForeground,
            }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={AMBER} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => <SaleCard item={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: isWeb ? 34 : insets.bottom + 120 }, !filtered.length && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AMBER} />}
          ListEmptyComponent={
            <EmptyState
              icon="shopping-cart"
              title="لا توجد مبيعات"
              subtitle={search ? "لا نتائج للبحث" : "اضغط + لإنشاء أول فاتورة بيع"}
            />
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: isWeb ? 34 : insets.bottom + 80 }]}
        onPress={() => router.push("/new-sale")}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#000000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 20,
    position: "relative",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAccentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: AMBER,
  },
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    marginTop: 4,
  },
  headerStats: { alignItems: "center" },
  headerStatVal: { fontSize: 15, fontFamily: "Tajawal_700Bold", textAlign: "center" },
  headerStatLbl: { fontSize: 10, fontFamily: "Tajawal_400Regular", marginTop: 1, textAlign: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Tajawal_700Bold", textAlign: "center", letterSpacing: -0.4 },
  headerSub: { fontSize: 12, fontFamily: "Tajawal_400Regular", textAlign: "center", marginBottom: 12 },
  searchBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Tajawal_400Regular" },
  statusFilters: {
    flexDirection: "row-reverse",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  statusChipText: { fontSize: 12, fontFamily: "Tajawal_500Medium" },
  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },
  fab: {
    position: "absolute",
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: AMBER,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 3,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  invoiceRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  invoice: { fontSize: 14, fontFamily: "Tajawal_700Bold" },
  date: { fontSize: 12, fontFamily: "Tajawal_400Regular" },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Tajawal_700Bold" },
  customer: { fontSize: 15, fontFamily: "Tajawal_500Medium", textAlign: "right", marginBottom: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  amountRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  amounts: { flexDirection: "row-reverse", gap: 12, alignItems: "center" },
  amountCol: { alignItems: "flex-end" },
  amtLabel: { fontSize: 10, fontFamily: "Tajawal_400Regular", marginBottom: 2 },
  amtVal: { fontSize: 15, fontFamily: "Tajawal_700Bold" },
  amtSep: { width: StyleSheet.hairlineWidth, height: 28 },
  paymentType: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  paymentText: { fontSize: 12, fontFamily: "Tajawal_700Bold" },
});
