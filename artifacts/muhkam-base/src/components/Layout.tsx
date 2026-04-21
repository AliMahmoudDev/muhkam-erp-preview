import { useState } from "react";
import { Link, useLocation } from "wouter";
import { clearToken } from "../api/client";
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  ShoppingCart,
  ShoppingBag,
  Receipt,
  Menu,
  X,
  LogOut,
  ChevronLeft,
} from "lucide-react";

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface Props {
  user: User;
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/products", label: "المنتجات", icon: Package },
  { href: "/customers", label: "العملاء", icon: Users },
  { href: "/suppliers", label: "الموردين", icon: Truck },
  { href: "/sales", label: "المبيعات", icon: ShoppingCart },
  { href: "/purchases", label: "المشتريات", icon: ShoppingBag },
  { href: "/expenses", label: "المصروفات", icon: Receipt },
];

export default function Layout({ user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location] = useLocation();

  const logout = () => {
    clearToken();
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <aside
        className={`flex flex-col bg-white border-l border-slate-200 shadow-sm transition-all duration-300 ${
          sidebarOpen ? "w-60" : "w-16"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
          {sidebarOpen && (
            <div>
              <p className="font-bold text-blue-700 text-lg leading-none">محكم BASE</p>
              <p className="text-xs text-slate-400 mt-0.5">إدارة متكاملة</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link key={href} href={href}>
                <a
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <Icon size={18} className={active ? "text-blue-600" : "text-slate-400"} />
                  {sidebarOpen && <span>{label}</span>}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div
            className={`flex items-center gap-3 px-2 py-2 ${
              sidebarOpen ? "" : "justify-center"
            }`}
          >
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-slate-400 truncate">{user.username}</p>
              </div>
            )}
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
