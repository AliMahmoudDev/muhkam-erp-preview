import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import { Clock, LogIn, LogOut, Settings, Calculator, Briefcase } from 'lucide-react';
import AttendanceSummary from './AttendanceSummary';
import AttendanceList from './AttendanceList';
import { CheckInModal, CheckOutModal, EditRecordModal } from './AttendanceFormModal';
import { AttendanceShiftsTab } from './AttendanceShiftsTab';
import { DeductionSettingsModal, DeductionCalcModal } from './AttendanceDeductionModals';
import { useAttendanceData } from './hooks/useAttendanceData';

type AnyRec = Record<string, unknown>;

const TABS = [
  { key: 'records',    label: 'سجلات الحضور',     icon: Clock },
  { key: 'shifts',     label: 'المناوبات',          icon: Briefcase },
  { key: 'deductions', label: 'الخصومات التلقائية', icon: Calculator },
] as const;

export default function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, 'can_manage_attendance');

  const today = new Date().toISOString().split('T')[0]!;
  const [activeTab, setActiveTab] = useState('records');
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]!; });
  const [to, setTo] = useState(() => today);
  const [empSearch, setEmpSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showEditRecord, setShowEditRecord] = useState(false);
  const [showDedSettings, setShowDedSettings] = useState(false);

  const [checkInForm, setCheckInForm] = useState({ employee_id: '', attendance_date: today, check_in_time: '', notes: '' });
  const [checkOutForm, setCheckOutForm] = useState({ employee_id: '', attendance_date: today, check_out_time: '' });
  const [editForm, setEditForm] = useState<{ id: number; check_in_time: string; check_out_time: string; status: string; notes: string; working_hours: string } | null>(null);

  const {
    records, dedSettings, dedTiers, shiftsQuery,
    doCheckIn, doCheckOut, doEditRecord,
    saveDedSettings, saveTiers, previewDed, applyDed,
    doAddShift, doEditShift, doDeleteShift, doAssignShift,
    allRecords, empList,
  } = useAttendanceData({ from, to, statusFilter });

  const recordsList = empSearch
    ? allRecords.filter((r) => {
        const name = `${r.first_name_ar ?? ''} ${r.last_name_ar ?? ''}`;
        return name.includes(empSearch) || String(r.employee_code ?? '').includes(empSearch);
      })
    : allRecords;

  const present = allRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absent = allRecords.filter((r) => r.status === 'absent').length;
  const late = allRecords.filter((r) => r.status === 'late').length;
  const totalHours = allRecords.reduce((s, r) => s + (Number(r.working_hours) || 0), 0);

  function openCheckOut(rec: AnyRec) {
    setCheckOutForm({ employee_id: String(rec.employee_id), attendance_date: String(rec.attendance_date), check_out_time: new Date().toTimeString().substring(0, 5) });
    setShowCheckOut(true);
  }
  function openEdit(rec: AnyRec) {
    setEditForm({ id: Number(rec.id), check_in_time: String(rec.check_in_time ?? ''), check_out_time: String(rec.check_out_time ?? ''), status: String(rec.status), notes: String(rec.notes ?? ''), working_hours: String(rec.working_hours ?? '') });
    setShowEditRecord(true);
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Clock size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">الحضور والانصراف</h1>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowCheckIn(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"><LogIn size={14} /> تسجيل حضور</button>
            <button onClick={() => setShowCheckOut(true)} className="erp-btn erp-btn-secondary flex items-center gap-1 text-sm"><LogOut size={14} /> تسجيل انصراف</button>
            {activeTab === 'deductions' && (
              <button onClick={() => setShowDedSettings(true)} className="erp-btn erp-btn-ghost flex items-center gap-1 text-sm"><Settings size={14} /> إعدادات الخصم</button>
            )}
          </div>
        )}
      </div>

      <AttendanceSummary total={allRecords.length} present={present} absent={absent} late={late} />

      <div className="flex gap-1 border-b border-white/10 mb-2 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg transition-all ${activeTab === t.key ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-400' : 'text-white/50 hover:text-white/80'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'records' && (
        <AttendanceList
          isLoading={records.isLoading} recordsList={recordsList} totalHours={totalHours}
          from={from} setFrom={setFrom} to={to} setTo={setTo}
          empSearch={empSearch} setEmpSearch={setEmpSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          canManage={canManage} openCheckOut={openCheckOut} openEdit={openEdit}
        />
      )}

      {activeTab === 'shifts' && (
        <AttendanceShiftsTab
          canManage={canManage} empList={empList} today={today}
          shifts={safeArray(shiftsQuery.data)} shiftsLoading={shiftsQuery.isLoading}
          doAddShift={doAddShift} doEditShift={doEditShift}
          doDeleteShift={doDeleteShift} doAssignShift={doAssignShift}
        />
      )}

      {activeTab === 'deductions' && canManage && (
        <DeductionCalcModal
          employees={empList} today={today} onClose={() => setActiveTab('records')}
          onPreview={(month, employee_id) => previewDed.mutate({ month, employee_id })}
          previewData={previewDed.data as AnyRec | undefined} previewing={previewDed.isPending}
          onApply={(items) => applyDed.mutate(items, { onSuccess: () => { previewDed.reset(); qc.invalidateQueries({ queryKey: ['employee-deductions'] }); } })}
          applying={applyDed.isPending} inline
        />
      )}

      {showCheckIn && (
        <CheckInModal empList={empList} form={checkInForm} setForm={setCheckInForm} today={today}
          isPending={doCheckIn.isPending} onClose={() => setShowCheckIn(false)}
          onSubmit={() => {
            if (!checkInForm.employee_id) { toast({ title: 'يرجى اختيار الموظف', variant: 'destructive' }); return; }
            doCheckIn.mutate(
              { ...checkInForm, attendance_date: checkInForm.attendance_date || today, check_in_time: checkInForm.check_in_time || new Date().toTimeString().substring(0, 5) },
              { onSuccess: () => { setShowCheckIn(false); setCheckInForm({ employee_id: '', attendance_date: today, check_in_time: '', notes: '' }); } }
            );
          }}
        />
      )}

      {showCheckOut && (
        <CheckOutModal empList={empList} form={checkOutForm} setForm={setCheckOutForm}
          isPending={doCheckOut.isPending} onClose={() => setShowCheckOut(false)}
          onSubmit={() => {
            if (!checkOutForm.employee_id) { toast({ title: 'يرجى اختيار الموظف', variant: 'destructive' }); return; }
            doCheckOut.mutate({ ...checkOutForm }, { onSuccess: () => { setShowCheckOut(false); setCheckOutForm({ employee_id: '', attendance_date: today, check_out_time: '' }); } });
          }}
        />
      )}

      {showEditRecord && editForm && (
        <EditRecordModal form={editForm} setForm={setEditForm}
          isPending={doEditRecord.isPending} onClose={() => setShowEditRecord(false)}
          onSubmit={() => {
            doEditRecord.mutate(
              { ...editForm, working_hours: editForm.working_hours ? Number(editForm.working_hours) : undefined },
              { onSuccess: () => { setShowEditRecord(false); setEditForm(null); } }
            );
          }}
        />
      )}

      {showDedSettings && canManage && (
        <DeductionSettingsModal
          settings={dedSettings.data as AnyRec | undefined}
          tiers={safeArray(dedTiers.data)}
          onClose={() => setShowDedSettings(false)}
          onSaveSettings={(s) => saveDedSettings.mutate(s)}
          onSaveTiers={(t) => saveTiers.mutate(t)}
          savingSettings={saveDedSettings.isPending}
          savingTiers={saveTiers.isPending}
        />
      )}
    </div>
  );
}
