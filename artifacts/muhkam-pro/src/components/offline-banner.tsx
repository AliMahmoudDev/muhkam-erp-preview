import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline]       = useState(!navigator.onLine);
  const [justBack, setJustBack]     = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline  = () => {
      setOffline(false);
      setJustBack(true);
      setTimeout(() => setJustBack(false), 3000);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online",  goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online",  goOnline);
    };
  }, []);

  if (!offline && !justBack) return null;

  return (
    <div
      dir="rtl"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-500 ${
        offline
          ? "bg-red-600/90 text-white"
          : "bg-green-600/90 text-white"
      }`}
    >
      {offline ? (
        <><WifiOff size={15} /> لا يوجد اتصال بالإنترنت</>
      ) : (
        <><Wifi size={15} /> تم استعادة الاتصال</>
      )}
    </div>
  );
}
