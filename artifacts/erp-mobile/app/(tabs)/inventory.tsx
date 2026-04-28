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
const INVENTORY_COLOR = "#8B5CF6";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  cost_price: number;
  sale_price: number;
  low_stock_threshold: number | null;
}

function ProductCard({ item }: { item: Product }) {
  const c = useColors();
  const isOut = item.quantity <= 0;
  const isLow = !isOut && item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold;
  const stockColor = isOut ? "#EF4444" : isLow ? AMBER : "#10B981";
  const stockLabel = isOut ? "نفذ" : isLow ? "منخفض" : "متاح";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}
      onPress={() => router.push({ pathname: "/product-details", params: { id: String(item.id) } })}
      activeOpacity={0.8}
    >
      <View style={[styles.cardLeft, { backgroundColor: stockColor + "15", borderRightWidth: 1, borderRightColor: stockColor + "30" }]}>
        <Text style={[styles.qtyNum, { color: stockColor }]}>{item.quantity}</Text>
        <Text style={[styles.qtyUnit, { color: stockColor + "AA" }]}>وحدة</Text>
        <View style={[styles.stockBadge, { backgroundColor: stockColor + "25", borderColor: stockColor + "40" }]}>
          <Text style={[styles.stockBadgeText, { color: stockColor }]}>{stockLabel}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>{item.name}</Text>
        <View style={styles.metaRow}>
          {item.category ? (
            <View style={[styles.catPill, { backgroundColor: INVENTORY_COLOR + "15" }]}>
              <Text style={[styles.meta, { color: INVENTORY_COLOR }]}>{item.category}</Text>
            </View>
          ) : null}
          {item.sku ? <Text style={[styles.sku, { color: c.mutedForeground }]}>#{item.sku}</Text> : null}
        </View>
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: AMBER }]}>{formatCurrency(item.sale_price)} ج.م</Text>
          <Text style={[styles.priceLabel, { color: c.mutedForeground }]}>سعر البيع</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "low", label: "منخفض" },
  { key: "out", label: "نفذ" },
];

export default function InventoryScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiFetch<Product[]>("/api/products"),
    staleTime: 30_000,
  });

  const filtered = (data || []).filter((p) => {
    const matchSearch = !search || p.name.includes(search) || (p.sku || "").includes(search);
    const matchFilter =
      filter === "all" ||
      (filter === "low" && p.low_stock_threshold != null && p.quantity > 0 && p.quantity <= p.low_stock_threshold) ||
      (filter === "out" && p.quantity <= 0);
    return matchSearch && matchFilter;
  });

  const lowCount = (data || []).filter(
    (p) => p.low_stock_threshold != null && p.quantity <= p.low_stock_threshold
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScreenHeader
        title="المخزون"
        subtitle={`${data?.length || 0} منتج${lowCount > 0 ? ` • ${lowCount} يحتاج تجديد` : ""}`}
        accentColor={INVENTORY_COLOR}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث بالاسم أو الكود..."
        filters={FILTERS}
        activeFilter={filter}
        onFilterChange={setFilter}
      />

      {isLoading ? (
        <ActivityIndicator color={INVENTORY_COLOR} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => <ProductCard item={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 100 },
            !filtered.length && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={INVENTORY_COLOR} />}
          ListEmptyComponent={
            <EmptyState
              icon="package"
              title="لا توجد منتجات"
              subtitle="اضغط + لإضافة أول منتج"
            />
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: isWeb ? 34 : insets.bottom + 80, backgroundColor: INVENTORY_COLOR }]}
        onPress={() => router.push("/new-product")}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#FFFFFF" />
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
    justifyContent: "center",
    alignItems: "center",
    shadowColor: INVENTORY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    overflow: "hidden",
  },
  cardLeft: {
    width: 82,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  qtyNum: { fontSize: 24, fontFamily: "Tajawal_700Bold" },
  qtyUnit: { fontSize: 11, fontFamily: "Tajawal_400Regular" },
  stockBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 4,
  },
  stockBadgeText: { fontSize: 10, fontFamily: "Tajawal_700Bold" },
  cardRight: { flex: 1, padding: 14, alignItems: "flex-end" },
  name: { fontSize: 15, fontFamily: "Tajawal_700Bold", textAlign: "right", marginBottom: 6 },
  metaRow: { flexDirection: "row-reverse", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  catPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  meta: { fontSize: 11, fontFamily: "Tajawal_500Medium" },
  sku: { fontSize: 11, fontFamily: "Tajawal_400Regular", paddingVertical: 3 },
  priceRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  priceLabel: { fontSize: 11, fontFamily: "Tajawal_400Regular" },
  price: { fontSize: 16, fontFamily: "Tajawal_700Bold" },
});
