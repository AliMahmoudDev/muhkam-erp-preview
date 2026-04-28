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
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { apiFetch, formatCurrency } from "@/lib/api";

const AMBER = "#F59E0B";

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  balance: number;
  customer_code: number | null;
}

function CustomerCard({ item }: { item: Customer }) {
  const c = useColors();
  const isDebt = item.balance < 0;
  const isCredit = item.balance > 0;
  const balColor = isDebt ? "#EF4444" : isCredit ? "#10B981" : c.mutedForeground;
  const balLabel = isDebt ? "مديون" : isCredit ? "دائن" : "متوازن";
  const initial = item.name.charAt(0);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}
      onPress={() => router.push({ pathname: "/customer-details", params: { id: String(item.id) } })}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        <View style={[styles.balanceBox, { backgroundColor: balColor + "18", borderColor: balColor + "30" }]}>
          <Text style={[styles.balLabel, { color: balColor }]}>{balLabel}</Text>
          <Text style={[styles.balValue, { color: balColor }]}>{formatCurrency(Math.abs(item.balance))}</Text>
          <Text style={[styles.balCurrency, { color: balColor }]}>ج.م</Text>
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
          {item.phone ? (
            <View style={styles.phoneRow}>
              <Text style={[styles.phone, { color: c.mutedForeground }]}>{item.phone}</Text>
              <Feather name="phone" size={12} color={c.mutedForeground} />
            </View>
          ) : null}
          {item.customer_code ? (
            <Text style={[styles.code, { color: AMBER }]}>#{item.customer_code}</Text>
          ) : null}
        </View>

        <View style={styles.rightCol}>
          <View style={[styles.avatar, { backgroundColor: AMBER + "18", borderColor: AMBER + "30" }]}>
            <Text style={[styles.avatarText, { color: AMBER }]}>{initial}</Text>
          </View>
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: isDebt ? "#10B981" : "#EF4444" }]}
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: "/payment",
                params: {
                  customerId: String(item.id),
                  customerName: item.name,
                  currentBalance: String(item.balance),
                  type: isDebt ? "receive" : "pay",
                },
              });
            }}
            activeOpacity={0.8}
          >
            <Feather name={isDebt ? "arrow-down-left" : "arrow-up-right"} size={12} color="#fff" />
            <Text style={styles.payBtnText}>{isDebt ? "استلام" : "دفع"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "debt", label: "مديونون" },
  { key: "credit", label: "دائنون" },
];

export default function CustomersScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiFetch<Customer[]>("/api/customers"),
    staleTime: 30_000,
  });

  const filtered = (data || []).filter((cu) => {
    const matchSearch = !search || cu.name.includes(search) || (cu.phone || "").includes(search);
    const matchFilter =
      filter === "all" || (filter === "debt" && cu.balance < 0) || (filter === "credit" && cu.balance > 0);
    return matchSearch && matchFilter;
  });

  const totalDebt = (data || []).reduce((acc, cu) => acc + (cu.balance < 0 ? Math.abs(cu.balance) : 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScreenHeader
        title="العملاء"
        subtitle={`${data?.length || 0} عميل${totalDebt > 0 ? ` • ديون: ${formatCurrency(totalDebt)} ج.م` : ""}`}
        accentColor={AMBER}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث بالاسم أو الهاتف..."
        filters={FILTERS}
        activeFilter={filter}
        onFilterChange={setFilter}
      />

      {isLoading ? (
        <ActivityIndicator color={AMBER} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => <CustomerCard item={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 100 },
            !filtered.length && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AMBER} />}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title="لا يوجد عملاء"
              subtitle="أضف أول عميل الآن"
            />
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: isWeb ? 34 : insets.bottom + 80 }]}
        onPress={() => router.push("/new-customer")}
        activeOpacity={0.85}
      >
        <Feather name="user-plus" size={22} color="#0a0500" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  rightCol: { alignItems: "center", gap: 6 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  avatarText: { fontSize: 18, fontFamily: "Tajawal_700Bold" },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  payBtnText: { color: "#fff", fontSize: 10, fontFamily: "Tajawal_700Bold" },
  info: { flex: 1, alignItems: "flex-end" },
  name: { fontSize: 15, fontFamily: "Tajawal_700Bold", textAlign: "right" },
  phoneRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4, marginTop: 3 },
  phone: { fontSize: 13, fontFamily: "Tajawal_400Regular" },
  code: { fontSize: 12, fontFamily: "Tajawal_700Bold", marginTop: 2 },
  balanceBox: {
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    minWidth: 80,
    borderWidth: 1,
  },
  balLabel: { fontSize: 10, fontFamily: "Tajawal_700Bold", marginBottom: 2 },
  balValue: { fontSize: 15, fontFamily: "Tajawal_700Bold" },
  balCurrency: { fontSize: 10, fontFamily: "Tajawal_400Regular" },
});
