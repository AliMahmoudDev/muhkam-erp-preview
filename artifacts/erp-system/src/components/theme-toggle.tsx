import { Moon, Sun } from "lucide-react";
import { useAppSettings } from "@/contexts/app-settings";

export function ThemeToggle() {
  const { settings, update } = useAppSettings();
  const isDark = (settings.theme ?? "dark") === "dark";

  return (
    <button
      onClick={() => update({ theme: isDark ? "light" : "dark" })}
      dir="ltr"
      aria-label={isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
      title={isDark ? "الوضع النهاري" : "الوضع الليلي"}
      className="relative flex items-center select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-full transition-transform duration-150 active:scale-[0.92]"
      style={{ width: 80, height: 36 }}
    >
      {/* Track */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: isDark ? "rgba(15,23,42,0.85)" : "rgba(241,245,249,0.92)",
          border: "1.5px solid",
          borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)",
          transition: "background-color 0.35s, border-color 0.35s",
          boxShadow: isDark
            ? "inset 0 2px 8px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)"
            : "inset 0 1px 4px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.08)",
        }}
      />

      {/* Moon icon — left */}
      <div
        className="relative z-10 flex items-center justify-center"
        style={{ width: 36, height: 36, opacity: isDark ? 1 : 0.35, transition: "opacity 0.3s" }}
      >
        <Moon
          size={14}
          className="transition-colors duration-300"
          style={{ color: isDark ? "#fcd34d" : "#94a3b8" }}
          strokeWidth={2.2}
        />
      </div>

      {/* Sun icon — right */}
      <div
        className="relative z-10 flex items-center justify-center"
        style={{ width: 36, height: 36, opacity: isDark ? 0.35 : 1, transition: "opacity 0.3s" }}
      >
        <Sun
          size={14}
          className="transition-colors duration-300"
          style={{ color: isDark ? "#64748b" : "#f59e0b" }}
          strokeWidth={2.2}
        />
      </div>

      {/* Sliding knob */}
      <div
        className="absolute z-20 rounded-full"
        style={{
          top: 3,
          left: isDark ? 3 : 43,
          width: 28,
          height: 28,
          background: "white",
          transition: "left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          boxShadow: isDark
            ? "0 2px 10px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.35)"
            : "0 2px 8px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.10)",
        }}
      />
    </button>
  );
}
