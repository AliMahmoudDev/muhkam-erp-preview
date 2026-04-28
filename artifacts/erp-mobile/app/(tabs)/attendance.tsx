import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
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
  if (s === "on_leave")return "إجازة";
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

function pad(n: number) { return n.toString().padStart(2, "0"); }

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTH_NAMES = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export default function AttendanceScreen() {
  const c      = useColors();
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  const [locLoading, setLocLoading] = useState(false);

  // Live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today   = now.toISOString().split("T")[0];
  const nowStr  = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateLabel = `${DAY_NAMES[now.getDay()]}، ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  // Last 7 days range
  const days7 = getLast7Days();
  const fromDate = days7[days7.length - 1];

  const { data: records = [], isLoading, refetch } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance-my", fromDate, today],
    queryFn: () =>
      apiFetch<AttendanceRecord[]>(
        `/api/attendance/records?from=${fromDate}&to=${today}`
      ),
    retry: 1,
  });

  const todayRecord: AttendanceRecord | undefined = records.find(r => r.attendance_date === today);

  const checkedIn  = !!todayRecord?.check_in_time;
  const checkedOut = !!todayRecord?.check_out_time;

  const checkInMut = useMutation({
    mutationFn: (notes?: string) =>
      apiFetch("/api/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-my"] }),
    onError: (e: Error) => Alert.alert("خطأ", e.message),
  });

  const checkOutMut = useMutation({
    mutationFn: () =>
      apiFetch("/api/attendance/check-out", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-my"] }),
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

  const isBusy = checkInMut.isPending || checkOutMut.isPending || locLoading;
  const btnDisabled = isBusy || (checkedIn && checkedOut);
  const btnColor    = !checkedIn ? GREEN : checkedOut ? "#475569" : RED;
  const btnLabel    = !checkedIn ? "تسجيل الحضور" : checkedOut ? "تم التسجيل" : "تسجيل الانصراف";
  const btnIcon     = !checkedIn ? "log-in" : checkedOut ? "check-circle" : "log-out";

  // Past 6 days (excluding today)
  const historyRecords = days7.slice(1).map(date => ({
    date,
    record: records.find(r => r.attendance_date === date) ?? null,
    dayName: DAY_NAMES[new Date(date + "T12:00:00").getDay()],
    dayNum: new Date(date + "T12:00:00").getDate(),
  }));

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={AMBER} />}
    >
      {/* Header */}
      <Text style={[styles.title, { color: c.foreground }]}>الحضور والانصراف</Text>
      <Text style={[styles.dateText, { color: c.mutedForeground }]}>{dateLabel}</Text>

      {/* Live Clock card */}
      <LinearGradient
        colors={["#0A0E1F", "#111628", "#1A1040"]}
        style={styles.clockCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.clockAccent, { backgroundColor: AMBER + "30" }]} />
        <Text style={styles.clock}>{nowStr}</Text>
        <Text style={[styles.clockSub, { color: "rgba(255,255,255,0.5)" }]}>الوقت الحالي</Text>
      </LinearGradient>

      {/* Today Status */}
      {todayRecord ? (
        <View style={[styles.statusCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(todayRecord.status) }]} />
            <Text style={[styles.statusLabel, { color: c.foreground }]}>{statusLabel(todayRecord.status)}</Text>
            {(todayRecord.late_minutes ?? 0) > 0 ? (
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
        <Text style={[styles.gpsNote, { color: c.mutedForeground }]}>جاري تحديد الموقع الجغرافي...</Text>
      )}
      {!checkedIn && !locLoading && (
        <View style={styles.gpsInfoRow}>
          <Feather name="map-pin" size={12} color={c.mutedForeground} />
          <Text style={[styles.gpsInfoText, { color: c.mutedForeground }]}>سيتم تسجيل موقعك الجغرافي عند الحضور</Text>
        </View>
      )}

      {/* ── آخر 7 أيام ── */}
      <Text style={[styles.sectionTitle, { color: c.foreground }]}>آخر 7 أيام</Text>
      <View style={[styles.historyCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        {historyRecords.map((item, idx) => (
          <View key={item.date}>
            <View style={styles.historyRow}>
              {/* Day info */}
              <View style={styles.historyDayCol}>
                <Text style={[styles.historyDayNum, { color: c.foreground }]}>{item.dayNum}</Text>
                <Text style={[styles.historyDayName, { color: c.mutedForeground }]}>{item.dayName}</Text>
              </View>

              {/* Dot */}
              <View style={[styles.historyDot, { backgroundColor: item.record ? statusColor(item.record.status) : c.border }]} />

              {/* Info */}
              <View style={styles.historyInfo}>
                {item.record ? (
                  <>
                    <View style={styles.historyTimesRow}>
                      <Text style={[styles.historyTime, { color: GREEN }]}>{fmtTime(item.record.check_in_time)}</Text>
                      <Text style={{ color: c.mutedForeground, fontSize: 11, marginHorizontal: 4 }}>—</Text>
                      <Text style={[styles.historyTime, { color: RED }]}>{fmtTime(item.record.check_out_time)}</Text>
                    </View>
                    <Text style={[styles.historyStatus, { color: statusColor(item.record.status) }]}>
                      {statusLabel(item.record.status)}
                      {item.record.working_hours ? `  •  ${fmtHours(item.record.working_hours)}` : ""}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.historyStatus, { color: c.mutedForeground }]}>لا يوجد سجل</Text>
                )}
              </View>
            </View>
            {idx < historyRecords.length - 1 && (
              <View style={[styles.historyDivider, { backgroundColor: c.border }]} />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Tajawal_700Bold", textAlign: "right", marginBottom: 4 },
  dateText: { fontSize: 13, fontFamily: "Tajawal_400Regular", textAlign: "right", marginBottom: 20 },
  clockCard: {
    borderRadius: 20, padding: 28,
    alignItems: "center", marginBottom: 16,
    overflow: "hidden", position: "relative",
    borderWidth: 1, borderColor: "#FFFFFF10",
  },
  clockAccent: {
    position: "absolute", top: -30, right: -30,
    width: 100, height: 100, borderRadius: 50,
  },
  clock: { fontSize: 46, fontFamily: "Tajawal_700Bold", letterSpacing: 3, color: "#F0F7FF" },
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
  gpsInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginBottom: 24 },
  gpsInfoText: { fontSize: 12, fontFamily: "Tajawal_400Regular" },

  sectionTitle: { fontSize: 16, fontFamily: "Tajawal_700Bold", marginBottom: 12, textAlign: "right" },
  historyCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  historyRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  historyDayCol: { alignItems: "center", width: 36 },
  historyDayNum: { fontSize: 16, fontFamily: "Tajawal_700Bold" },
  historyDayName: { fontSize: 10, fontFamily: "Tajawal_400Regular", marginTop: 1 },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyInfo: { flex: 1, alignItems: "flex-end" },
  historyTimesRow: { flexDirection: "row", alignItems: "center" },
  historyTime: { fontSize: 13, fontFamily: "Tajawal_700Bold" },
  historyStatus: { fontSize: 11, fontFamily: "Tajawal_400Regular", marginTop: 2 },
  historyDivider: { height: 1, marginHorizontal: 16 },
});
