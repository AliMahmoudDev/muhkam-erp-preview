import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import {
  authenticateWithBiometric,
  getBiometricCredentials,
  getBiometricStatus,
  saveBiometricCredentials,
  setBiometricEnabled,
  type BiometricStatus,
} from "@/hooks/useBiometric";

const AMBER = "#F59E0B";
const APP_VERSION = "2.0.0";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [biometric, setBiometric] = useState<BiometricStatus | null>(null);
  const [focusedField, setFocusedField] = useState<"user" | "pass" | null>(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const glowAnim  = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    getBiometricStatus().then(setBiometric);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, glowAnim]);

  const performLogin = async (u: string, p: string) => {
    if (!u.trim()) { setError("أدخل اسم المستخدم"); return; }
    if (!p.trim()) { setError("أدخل كلمة المرور"); return; }
    setLoading(true);
    setError("");
    try {
      await login(u.trim(), p);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const bStatus = await getBiometricStatus();
      if (bStatus.available && bStatus.enrolled && !bStatus.enabled && Platform.OS !== "web") {
        Alert.alert(
          "دخول أسرع بالبصمة",
          "فعّل البصمة / Face ID للدخول بدون كلمة مرور في المرات القادمة",
          [
            { text: "لاحقاً", style: "cancel", onPress: () => router.replace("/(tabs)") },
            {
              text: "تفعيل",
              onPress: async () => {
                const ok = await authenticateWithBiometric();
                if (ok) {
                  await saveBiometricCredentials(u.trim(), p);
                  await setBiometricEnabled(true);
                }
                router.replace("/(tabs)");
              },
            },
          ]
        );
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "اسم المستخدم أو كلمة المرور غير صحيحة");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometric?.enabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await authenticateWithBiometric();
    if (!ok) { setError("فشل التحقق بالبصمة"); return; }
    const creds = await getBiometricCredentials();
    if (!creds) { setError("لا توجد بيانات محفوظة — أدخل بياناتك مرة أخرى"); return; }
    await performLogin(creds.username, creds.pin);
  };

  const canLogin = username.trim().length > 0 && password.trim().length > 0;

  return (
    <View style={styles.root}>
      {/* Ambient glow */}
      <Animated.View
        style={[styles.ambientGlow, { opacity: glowAnim }]}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: isWeb ? 60 : insets.top + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View
            style={[styles.logoSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <View style={styles.logoGlow} pointerEvents="none" />
            <View style={styles.logoWrap}>
              <Image
                source={require("@/assets/images/muhkam-logo.png")}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
            <Text style={styles.brandName}>مُحكم</Text>
            <Text style={styles.brandSlogan}>نظام إدارة الموارد</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View
            style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>اسم المستخدم</Text>
              <View style={[
                styles.inputRow,
                focusedField === "user" && styles.inputRowFocused,
              ]}>
                <Feather name="user" size={17} color={username ? AMBER : "#8E8E93"} />
                <TextInput
                  style={styles.inputText}
                  placeholder="أدخل اسم المستخدم"
                  placeholderTextColor="#3C3C43"
                  value={username}
                  onChangeText={(t) => { setUsername(t); setError(""); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlign="right"
                  returnKeyType="next"
                  onFocus={() => setFocusedField("user")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>كلمة المرور</Text>
              <View style={[
                styles.inputRow,
                focusedField === "pass" && styles.inputRowFocused,
              ]}>
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showPassword ? "eye" : "eye-off"} size={17} color="#8E8E93" />
                </TouchableOpacity>
                <TextInput
                  style={styles.inputText}
                  placeholder="أدخل كلمة المرور"
                  placeholderTextColor="#3C3C43"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(""); }}
                  secureTextEntry={!showPassword}
                  textAlign="right"
                  returnKeyType="done"
                  onFocus={() => setFocusedField("pass")}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => canLogin && void performLogin(username, password)}
                />
                <Feather name="lock" size={17} color={password ? AMBER : "#8E8E93"} />
              </View>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={13} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Actions */}
            <View style={styles.actionsRow}>
              {biometric?.enabled && Platform.OS !== "web" ? (
                <TouchableOpacity
                  style={styles.biometricBtn}
                  onPress={handleBiometricLogin}
                  activeOpacity={0.75}
                >
                  <Feather
                    name={biometric.type === "face" ? "smile" : "aperture"}
                    size={24}
                    color={AMBER}
                  />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.loginBtn,
                  { backgroundColor: canLogin ? AMBER : "#1C1C1E" },
                  biometric?.enabled ? { flex: 1 } : { width: "100%" as any },
                ]}
                onPress={() => void performLogin(username, password)}
                disabled={loading || !canLogin}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={canLogin ? "#000000" : "#8E8E93"} size="small" />
                ) : (
                  <>
                    <Text style={[styles.loginBtnText, { color: canLogin ? "#000000" : "#8E8E93" }]}>
                      تسجيل الدخول
                    </Text>
                    <Feather name="arrow-left" size={17} color={canLogin ? "#000000" : "#8E8E93"} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Text style={styles.versionText}>مُحكم ERP v{APP_VERSION}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: isWeb ? 16 : insets.bottom + 8 }]}>
        <View style={styles.bottomDot} />
        <Text style={styles.bottomText}>نظام إدارة الموارد العربي</Text>
        <View style={styles.bottomDot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  ambientGlow: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
  },

  logoSection: { alignItems: "center", marginBottom: 40, position: "relative" },
  logoGlow: {
    position: "absolute",
    top: -10,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(245,158,11,0.18)",
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    marginBottom: 16,
  },
  logo: { width: 64, height: 64 },
  brandName: {
    fontSize: 30,
    fontFamily: "Tajawal_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandSlogan: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    color: "#8E8E93",
    textAlign: "center",
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#111111",
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#8E8E93",
    textAlign: "right",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputRowFocused: {
    borderColor: "rgba(245,158,11,0.5)",
    backgroundColor: "#1C1C1E",
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Tajawal_400Regular",
    color: "#FFFFFF",
    paddingVertical: 14,
    textAlign: "right",
  },

  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
  },
  errorText: {
    fontSize: 13,
    color: "#EF4444",
    fontFamily: "Tajawal_400Regular",
    flex: 1,
    textAlign: "right",
  },

  actionsRow: { flexDirection: "row-reverse", gap: 10, marginTop: 4 },
  biometricBtn: {
    width: 56,
    height: 54,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  loginBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  loginBtnText: { fontSize: 16, fontFamily: "Tajawal_700Bold" },

  versionText: {
    fontSize: 11,
    fontFamily: "Tajawal_400Regular",
    color: "#3C3C43",
    textAlign: "center",
    marginTop: 24,
  },

  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#000000",
  },
  bottomDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(245,158,11,0.5)",
  },
  bottomText: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    color: "#3C3C43",
  },
});
