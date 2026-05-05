import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
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
  return "#8E8E93";
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
  const isWeb  = Platform.OS === "web";
  const qc     = useQueryClient();
  const [locLoading, setLocLoading] = useState(false);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const today   = now.toISOString().split("T")[0];
  const nowStr  = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateLabel = `${DAY_NAMES[now.getDay()]}، ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const days7 = getLast7Days();
  const fromDate = days7[days7.length - 1];

  const { data: records = [], isLoading, refetch } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance-my", fromDate, today],
    queryFn: () => apiFetch<AttendanceRecord[]>(`/api/attendance/records?from=${fromDate}&to=${today}`),
    retry: 1,
  });

  const todayRecord: AttendanceRecord | undefined = records.find(r => r.attendance_date === today);
  const checkedIn  = !!todayRecord?.check_in_time;
  const checkedOut = !!todayRecord?.check_out_time;

  const checkInMut = useMutation({
    mutationFn: (notes?: string) =>
      apiFetch("/api/attendance/check-in", { method: "POST", body: JSON.stringify({ notes }) }),
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
    } catch { /* ignore */ }
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
  const btnColor    = !checkedIn ? GREEN : checkedOut ? "#2C2C2E" : RED;
  const btnLabel    = !checkedIn ? "تسجيل الحضور" : checkedOut ? "تم التسجيل" : "تسجيل الانصراف";
  const btnIcon: React.ComponentProps<typeof Feather>["name"] =
    !checkedIn ? "log-in" : checkedOut ? "check-circle" : "log-out";

  const historyRecords = days7.slice(1).map(date => ({
    date,
    record: records.find(r => r.attendance_date === date) ?? null,
    dayName: DAY_NAMES[new Date(date + "T12:00:00").getDay()],
    dayNum: new Date(date + "T12:00:00").getDate(),
  }));

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.background }]}
      contentContainerStyle={{
        paddingTop: isWeb ? 60 : insets.top + 20,
        paddingBottom: isWeb ? 34 : insets.bottom + 100,
        paddingHorizontal: 20,
      }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={AMBER} />}
    >
      {/* Header */}
      <Text style={[styles.title, { color: c.text }]}>الحضور والانصراف</Text>
      <Text style={[styles.dateText, { color: c.mutedForeground }]}>{dateLabel}</Text>

      {/* Clock card */}
      <View style={[styles.clockCard, {
        backgroundColor: c.isDark ? "#111111" : "#FFFFFF",
        borderColor: c.cardBorder,
      }]}>
        <View style={styles.clockContent}>
          <Text style={[styles.clock, { color: c.text }]}>{nowStr}</Text>
          <Text style={[styles.clockSub, { color: c.mutedForeground }]}>الوقت الحالي</Text>
        </View>
        {/* GPS indicator */}
        <View style={[styles.gpsTag, {
          backgroundColor: locLoading ? "rgba(59,130,246,0.12)" : "rgba(16,185,129,0.12)",
          borderColor: locLoading ? "rgba(59,130,246,0.25)" : "rgba(16,185,129,0.25)",
        }]}>
          <Feather name="map-pin" size={11} color={locLoading ? "#3B82F6" : GREEN} />
          <Text style={[styles.gpsTagText, { color: locLoading ? "#3B82F6" : GREEN }]}>
            {locLoading ? "جاري تحديد الموقع..." : "GPS جاهز"}
          </Text>
        </View>
      </View>

      {/* Today status */}
      {todayRecord ? (
        <View style={[styles.statusCard, { backgroundColor: c.isDark ? "#111111" : "#FFFFFF", borderColor: c.cardBorder }]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(todayRecord.status) }]} />
            <Text style={[styles.statusLabel, { color: c.text }]}>{statusLabel(todayRecord.status)}</Text>
            {(todayRecord.late_minutes ?? 0) > 0 && (
              <View style={[styles.lateBadge, { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.2)" }]}>
                <Text style={[styles.lateBadgeText, { color: AMBER }]}>تأخر {todayRecord.late_minutes} د</Text>
              </View>
            )}
          </View>
          <View style={styles.timesRow}>
            {[
              { icon: "log-in"  as const, label: "الحضور",     color: GREEN, val: fmtTime(todayRecord.check_in_time) },
              { icon: "log-out" as const, label: "الانصراف",   color: RED,   val: fmtTime(todayRecord.check_out_time) },
              { icon: "clock"   as const, label: "ساعات العمل", color: AMBER, val: fmtHours(todayRecord.working_hours) },
            ].map((t, i) => (
              <React.Fragment key={t.label}>
                {i > 0 && <View style={[styles.timeDivider, { backgroundColor: c.border }]} />}
                <View style={styles.timeBox}>
                  <View style={[styles.timeIconWrap, { backgroundColor: t.color + "15" }]}>
                    <Feather name={t.icon} size={14} color={t.color} />
                  </View>
                  <Text style={[styles.timeVal, { color: c.text }]}>{t.val}</Text>
                  <Text style={[styles.timeLabel, { color: c.mutedForeground }]}>{t.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.statusCard, { backgroundColor: c.isDark ? "#111111" : "#FFFFFF", borderColor: c.cardBorder }]}>
          <View style={styles.noRecordRow}>
            <View style={[styles.noRecordIcon, { backgroundColor: "rgba(245,158,11,0.1)" }]}>
              <Feather name="clock" size={20} color={AMBER} />
            </View>
            <Text style={[styles.noRecord, { color: c.mutedForeground }]}>لم يتم تسجيل حضور اليوم بعد</Text>
          </View>
        </View>
      )}

      {/* Action button */}
      <Animated.View style={{ transform: [{ scale: !btnDisabled && !checkedIn ? pulseAnim : new Animated.Value(1) }] }}>
        <TouchableOpacity
          onPress={!checkedIn ? handleCheckIn : handleCheckOut}
          disabled={btnDisabled}
          activeOpacity={0.85}
          style={[styles.actionBtn, {
            backgroundColor: btnColor,
            opacity: btnDisabled ? 0.55 : 1,
            shadowColor: btnColor,
          }]}
        >
          {isBusy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name={btnIcon} size={20} color={checkedOut ? "#8E8E93" : "#FFFFFF"} />
              <Text style={[styles.actionBtnText, { color: checkedOut ? "#8E8E93" : "#FFFFFF" }]}>
                {btnLabel}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* History */}
      <Text style={[styles.sectionTitle, { color: c.text }]}>آخر 7 أيام</Text>
      <View style={[styles.historyCard, { backgroundColor: c.isDark ? "#111111" : "#FFFFFF", borderColor: c.cardBorder }]}>
        {historyRecords.map((item, idx) => (
          <View key={item.date}>
            <View style={styles.historyRow}>
              <View style={[styles.historyDayBadge, {
                backgroundColor: item.record ? statusColor(item.record.status) + "18" : c.muted,
                borderColor: item.record ? statusColor(item.record.status) + "30" : c.border,
              }]}>
                <Text style={[styles.historyDayNum, { color: item.record ? statusColor(item.record.status) : c.mutedForeground }]}>
                  {item.dayNum}
                </Text>
                <Text style={[styles.historyDayName, { color: c.mutedForeground }]}>{item.dayName}</Text>
              </View>

              <View style={styles.historyInfo}>
                {item.record ? (
                  <>
                    <View style={styles.historyTimesRow}>
                      <Text style={[styles.historyTime, { color: GREEN }]}>{fmtTime(item.record.check_in_time)}</Text>
                      <Text style={{ color: c.mutedForeground, fontSize: 11, marginHorizontal: 6 }}>→</Text>
                      <Text style={[styles.historyTime, { color: RED }]}>{fmtTime(item.record.check_out_time)}</Text>
                    </View>
                    <Text style={[styles.historyStatus, { color: statusColor(item.record.status) }]}>
                      {statusLabel(item.record.status)}
                      {item.record.working_hours ? `  ·  ${fmtHours(item.record.working_hours)}` : ""}
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
  title: { fontSize: 28, fontFamily: "Tajawal_700Bold", textAlign: "right", marginBottom: 4, letterSpacing: -0.5 },
  dateText: { fontSize: 13, fontFamily: "Tajawal_400Regular", textAlign: "right", marginBottom: 20 },

  clockCard: {
    borderRadius: 20, padding: 28,
    borderWidth: 1, marginBottom: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clockContent: { alignItems: "flex-end" },
  clock: { fontSize: 44, fontFamily: "Tajawal_700Bold", letterSpacing: 2 },
  clockSub: { fontSize: 12, fontFamily: "Tajawal_400Regular", marginTop: 4 },
  gpsTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  gpsTagText: { fontSize: 11, fontFamily: "Tajawal_500Medium" },

  statusCard: {
    borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
    justifyContent: "flex-end",
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 15, fontFamily: "Tajawal_700Bold" },
  lateBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  lateBadgeText: { fontSize: 12, fontFamily: "Tajawal_500Medium" },
  timesRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  timeBox: { alignItems: "center", flex: 1, gap: 6 },
  timeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  timeVal: { fontSize: 14, fontFamily: "Tajawal_700Bold" },
  timeLabel: { fontSize: 10, fontFamily: "Tajawal_400Regular" },
  timeDivider: { width: 1, height: 50 },
  noRecordRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    paddingVertical: 6,
  },
  noRecordIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  noRecord: { fontSize: 14, fontFamily: "Tajawal_400Regular" },

  actionBtn: {
    borderRadius: 16,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 28,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  actionBtnText: { fontSize: 17, fontFamily: "Tajawal_700Bold" },

  sectionTitle: { fontSize: 17, fontFamily: "Tajawal_700Bold", marginBottom: 12, textAlign: "right", letterSpacing: -0.2 },
  historyCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  historyRow: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  historyDayBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 50,
  },
  historyDayNum: { fontSize: 16, fontFamily: "Tajawal_700Bold" },
  historyDayName: { fontSize: 9, fontFamily: "Tajawal_400Regular", marginTop: 1 },
  historyInfo: { flex: 1, alignItems: "flex-end" },
  historyTimesRow: { flexDirection: "row", alignItems: "center" },
  historyTime: { fontSize: 13, fontFamily: "Tajawal_700Bold" },
  historyStatus: { fontSize: 11, fontFamily: "Tajawal_400Regular", marginTop: 3 },
  historyDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
});
