/**
 * support-tab.tsx — معلومات التواصل للدعم الفني
 */
import {
  Phone,
  Mail,
  MessageSquare,
  Globe,
  Clock,
  Headphones,
  ExternalLink,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from './_shared';

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      title="نسخ"
      className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-all shrink-0"
    >
      {copied ? (
        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

interface ContactRow {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  color: string;
}

const CONTACTS: ContactRow[] = [
  {
    icon: Phone,
    label: 'هاتف الدعم',
    value: '+966 5X XXX XXXX',
    href: 'tel:+9665XXXXXXXX',
    color: 'text-emerald-400',
  },
  {
    icon: MessageSquare,
    label: 'واتساب',
    value: '+966 5X XXX XXXX',
    href: 'https://wa.me/9665XXXXXXXX',
    color: 'text-emerald-500',
  },
  {
    icon: Mail,
    label: 'البريد الإلكتروني',
    value: 'support@muhkam.com',
    href: 'mailto:support@muhkam.com',
    color: 'text-blue-400',
  },
  {
    icon: Globe,
    label: 'الموقع الرسمي',
    value: 'www.muhkam.com',
    href: 'https://muhkam.com',
    color: 'text-violet-400',
  },
];

const HOURS = [
  { day: 'الأحد — الخميس', time: '9:00 ص — 6:00 م' },
  { day: 'الجمعة', time: '10:00 ص — 2:00 م' },
  { day: 'السبت', time: 'مغلق' },
];

export default function SupportTab() {
  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="الدعم الفني"
        sub="تواصل مع فريق المحكم للمساعدة والاستفسار"
      />

      {/* بطاقة الاتصال الرئيسية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CONTACTS.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-xs font-semibold mb-0.5">{c.label}</p>
                <p className="text-white font-bold text-sm truncate">{c.value}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyBtn value={c.value} />
                {c.href && (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                    title="فتح"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ساعات العمل */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/6">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="font-bold text-white text-sm">ساعات العمل</p>
        </div>
        <div className="divide-y divide-white/5">
          {HOURS.map((h) => (
            <div key={h.day} className="flex items-center justify-between px-5 py-3">
              <span className="text-white/60 text-sm">{h.day}</span>
              <span
                className={`text-sm font-bold ${h.time === 'مغلق' ? 'text-red-400/70' : 'text-emerald-400'}`}
              >
                {h.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* بطاقة الدعم المباشر */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Headphones className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-amber-400 text-sm mb-1">الدعم المباشر</p>
          <p className="text-white/50 text-xs leading-relaxed">
            في حال وجود مشكلة عاجلة أو انقطاع في الخدمة، يُرجى التواصل عبر واتساب
            أو الاتصال المباشر. يستجيب الفريق خلال 30 دقيقة في أوقات الدوام الرسمي.
          </p>
        </div>
      </div>

      {/* معلومات النسخة */}
      <div className="rounded-xl border border-white/6 bg-white/[0.015] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/25 text-xs">
          <span>MUHKAM ERP</span>
          <span>·</span>
          <span>v2.1.0</span>
        </div>
        <span className="text-emerald-400/70 text-xs font-bold">الدعم نشط</span>
      </div>
    </div>
  );
}
