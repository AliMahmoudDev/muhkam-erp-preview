import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

const AMBER = "#F59E0B";
const GREEN = "#10B981";
const RED   = "#EF4444";

interface AttendanceRecord {
  id: number;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  working_hours: number | null;
  late_minutes: number | null;
  status: string;
  notes: string | null;
}

function statusLabel(s: string) {
  if (s === "present") return "حاضر";
  if (s === "late")    return "متأخر";
  if (s === "absent")  return "غائب";
  if (s === "holiday") return "إجازة رسمية";
  if (s === "leave")   return "إجازة";
  return s;
}

function statusColor(s: string) {
  if (s === "present") return GREEN;
  if (s === "late")    return AMBER;
  if (s === "absent")  return RED;
  return "#94A3B8";
}

function fmtTime(t: string | null | undefined) {
  if (!t) return "--:--";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "م" : "ص";
  const h12  = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function fmtHours(h: number | null) {
  if (h == null) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}س ${mins}د` : `${hrs} ساعة`;
}

export default function AttendanceScreen() {
  const c      = useColors();
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  const [locLoading, setLocLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const { data: records = [], isLoading, refetch } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance-my", today],
    queryFn: () =>
      apiFetch<AttendanceRecord[]>(
        `/api/attendance/records?from=${today}&to=${today}`
      ),
    retry: 1,
  });

  const todayRecord: AttendanceRecord | undefined = records[0];

  const checkedIn  = !!todayRecord?.check_in_time;
  const checkedOut = !!todayRecord?.check_out_time;

  const checkInMut = useMutation({
    mutationFn: (notes?: string) =>
      apiFetch("/api/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-my", today] }),
    onError: (e: Error) => Alert.alert("خطأ", e.message),
  });

  const checkOutMut = useMutation({
    mutationFn: () =>
      apiFetch("/api/attendance/check-out", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-my", today] }),
    onError: (e: Error) => Alert.alert("خطأ", e.message),
  });

  async function handleCheckIn() {
    setLocLoading(true);
    let locationNote = "";
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        locationNote = `GPS: ${loc.coords.latitude.toFixed(5)},${loc.coords.longitude.toFixed(5)}`;
      }
    } catch { /* ignore GPS errors */ }
    setLocLoading(false);
    checkInMut.mutate(locationNote || undefined);
  }

  function handleCheckOut() {
    Alert.alert("تأكيد الانصراف", "هل تريد تسجيل انصرافك الآن؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "تأكيد", onPress: () => checkOutMut.mutate() },
    ]);
  }

  const now    = new Date();
  const nowStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const dateLabel = `${dayNames[now.getDay()]}، ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const isBusy = checkInMut.isPending || checkOutMut.isPending || locLoading;

  const btnDisabled = isBusy || (checkedIn && checkedOut);
  const btnColor    = !checkedIn ? GREEN : checkedOut ? "#475569" : RED;
  const btnLabel    = !checkedIn ? "تسجيل الحضور" : checkedOut ? "تم التسجيل" : "تسجيل الانصراف";
  const btnIcon     = !checkedIn ? "log-in" : checkedOut ? "check-circle" : "log-out";

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={AMBER} />}
    >
      {/* Header */}
      <Text style={[styles.title, { color: c.foreground }]}>الحضور والانصراف</Text>
      <Text style={[styles.dateText, { color: c.mutedForeground }]}>{dateLabel}</Text>

      {/* Clock card */}
      <View style={[styles.clockCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <Text style={[styles.clock, { color: c.foreground }]}>{nowStr}</Text>
        <Text style={[styles.clockSub, { color: c.mutedForeground }]}>الوقت الحالي</Text>
      </View>

      {/* Status card */}
      {todayRecord ? (
        <View style={[styles.statusCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(todayRecord.status) }]} />
            <Text style={[styles.statusLabel, { color: c.foreground }]}>{statusLabel(todayRecord.status)}</Text>
            {todayRecord.late_minutes && todayRecord.late_minutes > 0 ? (
              <Text style={[styles.lateBadge, { backgroundColor: AMBER + "20", color: AMBER }]}>
                تأخر {todayRecord.late_minutes} د
              </Text>
            ) : null}
          </View>

          <View style={styles.timesRow}>
            <View style={styles.timeBox}>
              <Feather name="log-in" size={14} color={GREEN} />
              <Text style={[styles.timeVal, { color: c.foreground }]}>{fmtTime(todayRecord.check_in_time)}</Text>
              <Text style={[styles.timeLabel, { color: c.mutedForeground }]}>الحضور</Text>
            </View>
            <View style={[styles.timeDivider, { backgroundColor: c.border }]} />
            <View style={styles.timeBox}>
              <Feather name="log-out" size={14} color={RED} />
              <Text style={[styles.timeVal, { color: c.foreground }]}>{fmtTime(todayRecord.check_out_time)}</Text>
              <Text style={[styles.timeLabel, { color: c.mutedForeground }]}>الانصراف</Text>
            </View>
            <View style={[styles.timeDivider, { backgroundColor: c.border }]} />
            <View style={styles.timeBox}>
              <Feather name="clock" size={14} color={AMBER} />
              <Text style={[styles.timeVal, { color: c.foreground }]}>{fmtHours(todayRecord.working_hours)}</Text>
              <Text style={[styles.timeLabel, { color: c.mutedForeground }]}>ساعات العمل</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.statusCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[styles.noRecord, { color: c.mutedForeground }]}>
            لم يتم تسجيل حضور اليوم بعد
          </Text>
        </View>
      )}

      {/* Action button */}
      <TouchableOpacity
        onPress={!checkedIn ? handleCheckIn : handleCheckOut}
        disabled={btnDisabled}
        activeOpacity={0.85}
        style={[styles.actionBtn, { backgroundColor: btnColor, opacity: btnDisabled ? 0.6 : 1 }]}
      >
        {isBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name={btnIcon as any} size={20} color="#fff" />
            <Text style={styles.actionBtnText}>{btnLabel}</Text>
          </>
        )}
      </TouchableOpacity>

      {locLoading && (
        <Text style={[styles.gpsNote, { color: c.mutedForeground }]}>
          جاري تحديد الموقع الجغرافي...
        </Text>
      )}

      {/* GPS note */}
      {!checkedIn && (
        <View style={styles.gpsInfoRow}>
          <Feather name="map-pin" size={12} color={c.mutedForeground} />
          <Text style={[styles.gpsInfoText, { color: c.mutedForeground }]}>
            سيتم تسجيل موقعك الجغرافي عند الحضور
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Tajawal_700Bold", textAlign: "right", marginBottom: 4 },
  dateText: { fontSize: 13, fontFamily: "Tajawal_400Regular", textAlign: "right", marginBottom: 20 },
  clockCard: {
    borderRadius: 16, borderWidth: 1, padding: 24,
    alignItems: "center", marginBottom: 16,
  },
  clock: { fontSize: 48, fontFamily: "Tajawal_700Bold", letterSpacing: 2 },
  clockSub: { fontSize: 12, fontFamily: "Tajawal_400Regular", marginTop: 4 },
  statusCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, justifyContent: "flex-end" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 15, fontFamily: "Tajawal_700Bold" },
  lateBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, fontSize: 12, fontFamily: "Tajawal_500Medium" },
  timesRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  timeBox: { alignItems: "center", gap: 4, flex: 1 },
  timeVal: { fontSize: 15, fontFamily: "Tajawal_700Bold", marginTop: 4 },
  timeLabel: { fontSize: 11, fontFamily: "Tajawal_400Regular" },
  timeDivider: { width: 1, height: 40 },
  noRecord: { textAlign: "center", fontFamily: "Tajawal_400Regular", fontSize: 14, paddingVertical: 8 },
  actionBtn: {
    borderRadius: 14, height: 56, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12,
  },
  actionBtnText: { color: "#fff", fontSize: 17, fontFamily: "Tajawal_700Bold" },
  gpsNote: { textAlign: "center", fontSize: 12, fontFamily: "Tajawal_400Regular", marginBottom: 8 },
  gpsInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  gpsInfoText: { fontSize: 12, fontFamily: "Tajawal_400Regular" },
});
