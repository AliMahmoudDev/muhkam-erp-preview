import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormField } from "@/components/FormField";
import { ModalHeader } from "@/components/ModalHeader";
import { useColors } from "@/hooks/useColors";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";

const AMBER = "#F59E0B";

interface CustomerDetail {
  id: number;
  name: string;
  phone: string | null;
  balance: number;
  customer_code: number | null;
  is_supplier: boolean;
  transactions?: { id: number; type: string; amount: number; description: string | null; created_at: string }[];
}

export default function CustomerDetailsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => apiFetch<CustomerDetail>(`/api/customers/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (data) {
      setName(data.name);
      setPhone(data.phone || "");
      setBalance(String(Math.abs(data.balance)));
    }
  }, [data]);

  const { mutate: updateCustomer, isPending: updating } = useMutation({
    mutationFn: () =>
      apiFetch(`/api/customers/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null, balance: Number(balance) || 0 }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setEditing(false);
      Alert.alert("تم", "تم تحديث بيانات العميل");
    },
    onError: (e: any) => Alert.alert("خطأ", e.message || "فشل التحديث"),
  });

  const { mutate: deleteCustomer, isPending: deleting } = useMutation({
    mutationFn: () => apiFetch(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["customers"] });
      router.back();
    },
    onError: (e: any) => Alert.alert("خطأ", e.message || "فشل الحذف"),
  });

  const handleDelete = () => {
    Alert.alert("تأكيد الحذف", `هل تريد حذف "${data?.name}"؟\nسيتم حذف جميع بياناته.`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteCustomer() },
    ]);
  };

  const handlePayment = (type: "receive" | "pay") => {
    router.push({
      pathname: "/payment",
      params: {
        customerId: String(id),
        customerName: data?.name || "",
        currentBalance: String(data?.balance || 0),
        type,
      },
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <ModalHeader title="تفاصيل العميل" />
        <ActivityIndicator color={AMBER} size="large" style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <ModalHeader title="تفاصيل العميل" />
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: c.card }]}>
            <Feather name="user" size={32} color={c.mutedForeground} />
          </View>
          <Text style={[styles.emptyText, { color: c.mutedForeground }]}>العميل غير موجود</Text>
        </View>
      </View>
    );
  }

  const isDebt = data.balance < 0;
  const isCredit = data.balance > 0;
  const balColor = isDebt ? "#EF4444" : isCredit ? "#10B981" : "#94A3B8";
  const balLabel = isDebt ? "مديون" : isCredit ? "دائن" : "متوازن";
  const nameInitials = data.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const heroGradient: [string, string, string] = isDebt
    ? ["#1A0A0A", "#2D0F0F", "#1A0A0A"]
    : isCredit
    ? ["#0A1A12", "#0D2B1A", "#0A1A12"]
    : ["#0A0E1F", "#111628", "#0A0E1F"];

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ModalHeader
        title={editing ? "تعديل العميل" : ""}
        rightAction={editing
          ? { label: updating ? "..." : "حفظ", onPress: () => updateCustomer(), disabled: updating }
          : { label: "تعديل", onPress: () => setEditing(true) }}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 40 : insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!editing ? (
            <>
              <LinearGradient
                colors={heroGradient}
                style={styles.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={[styles.heroAvatar, { backgroundColor: balColor + "30", borderColor: balColor + "60" }]}>
                  <Text style={[styles.heroAvatarText, { color: balColor }]}>{nameInitials}</Text>
                </View>

                <Text style={styles.heroName}>{data.name}</Text>

                <View style={styles.heroMeta}>
                  {data.phone && (
                    <View style={[styles.metaPill, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                      <Feather name="phone" size={12} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.metaText}>{data.phone}</Text>
                    </View>
                  )}
                  {data.customer_code && (
                    <View style={[styles.metaPill, { backgroundColor: AMBER + "22" }]}>
                      <Text style={[styles.metaText, { color: AMBER }]}>#{data.customer_code}</Text>
                    </View>
                  )}
                  {data.is_supplier && (
                    <View style={[styles.metaPill, { backgroundColor: "#7C3AED22" }]}>
                      <Text style={[styles.metaText, { color: "#A78BFA" }]}>عميل + مورد</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.balanceCard, { backgroundColor: balColor + "18", borderColor: balColor + "35" }]}>
                  <Text style={[styles.balLabel, { color: balColor + "CC" }]}>{balLabel}</Text>
                  <Text style={[styles.balValue, { color: balColor }]}>
                    {formatCurrency(Math.abs(data.balance))}
                    <Text style={styles.balCurrency}> ج.م</Text>
                  </Text>
                </View>
              </LinearGradient>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handlePayment("receive")}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#065F46", "#059669"]}
                    style={styles.actionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                      <Feather name="arrow-down-left" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.actionText}>استلام دفعة</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handlePayment("pay")}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#7F1D1D", "#DC2626"]}
                    style={styles.actionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                      <Feather name="arrow-up-right" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.actionText}>تسديد دفعة</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {(data.transactions || []).length > 0 ? (
                <View style={styles.txSection}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionDot, { backgroundColor: AMBER }]} />
                    <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>آخر المعاملات</Text>
                  </View>
                  <View style={[styles.txCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
                    {(data.transactions || []).slice(0, 10).map((t, idx, arr) => {
                      const isIncoming = t.type === "in" || t.type === "receive";
                      const txColor = isIncoming ? "#10B981" : "#EF4444";
                      return (
                        <View
                          key={t.id}
                          style={[
                            styles.txRow,
                            idx < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
                          ]}
                        >
                          <View style={[styles.txIcon, { backgroundColor: txColor + "18" }]}>
                            <Feather name={isIncoming ? "arrow-down" : "arrow-up"} size={13} color={txColor} />
                          </View>
                          <View style={styles.txInfo}>
                            <Text style={[styles.txDesc, { color: c.text }]} numberOfLines={1}>
                              {t.description || (isIncoming ? "استلام دفعة" : "تسديد دفعة")}
                            </Text>
                            <Text style={[styles.txDate, { color: c.mutedForeground }]}>{formatDate(t.created_at)}</Text>
                          </View>
                          <Text style={[styles.txAmount, { color: txColor }]}>
                            {isIncoming ? "+" : "-"}{formatCurrency(t.amount)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={[styles.emptyTx, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
                  <Feather name="clock" size={28} color={c.mutedForeground} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptyTxText, { color: c.mutedForeground }]}>لا توجد معاملات بعد</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.deleteBtn, { opacity: deleting ? 0.6 : 1 }]}
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
                <Text style={styles.deleteBtnText}>حذف العميل</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.editCard, { backgroundColor: c.card, borderColor: AMBER + "30" }]}>
                <View style={[styles.editCardLine, { backgroundColor: AMBER }]} />
                <View style={{ padding: 16 }}>
                  <FormField label="اسم العميل" required placeholder="اسم العميل" value={name} onChangeText={setName} />
                  <FormField label="رقم الهاتف" placeholder="01xxxxxxxxx" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  <FormField label="الرصيد" placeholder="0" value={balance} onChangeText={setBalance} keyboardType="numeric" suffix="ج.م" />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { opacity: updating ? 0.6 : 1 }]}
                onPress={() => updateCustomer()}
                disabled={updating}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[AMBER, "#D97706"]}
                  style={styles.saveGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {updating
                    ? <ActivityIndicator color="#0a0500" />
                    : <><Feather name="check" size={18} color="#0a0500" /><Text style={styles.saveBtnText}>حفظ التعديلات</Text></>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 14 },
  hero: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    marginBottom: 4,
  },
  heroAvatarText: {
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
  },
  heroName: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    color: "#F0F7FF",
    textAlign: "center",
  },
  heroMeta: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  metaPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  balanceCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    marginTop: 6,
    minWidth: 200,
  },
  balLabel: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    marginBottom: 4,
  },
  balValue: {
    fontSize: 28,
    fontFamily: "Tajawal_700Bold",
    letterSpacing: -0.5,
  },
  balCurrency: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
  },
  actionRow: {
    flexDirection: "row-reverse",
    gap: 12,
    paddingHorizontal: 16,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  actionGradient: {
    paddingVertical: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
  txSection: { gap: 8, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  sectionDot: { width: 3, height: 14, borderRadius: 2 },
  sectionTitle: { fontSize: 12, fontFamily: "Tajawal_500Medium" },
  txCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  txRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  txInfo: { flex: 1, alignItems: "flex-end" },
  txDesc: { fontSize: 13, fontFamily: "Tajawal_500Medium" },
  txDate: { fontSize: 11, fontFamily: "Tajawal_400Regular", marginTop: 2 },
  txAmount: { fontSize: 14, fontFamily: "Tajawal_700Bold" },
  emptyTx: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyTxText: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
  },
  deleteBtn: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EF444440",
    paddingVertical: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF444410",
  },
  deleteBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
  editCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  editCardLine: { height: 2 },
  saveBtn: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  saveGradient: {
    paddingVertical: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnText: {
    color: "#0a0500",
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
  },
});
