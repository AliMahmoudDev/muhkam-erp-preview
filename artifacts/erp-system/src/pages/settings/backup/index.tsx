import { HardDrive, Download, Server, Shield } from 'lucide-react';
import { useBackupActions } from './hooks/useBackupActions';
import BackupLocalTab from './BackupLocalTab';
import BackupServerTab from './BackupServerTab';
import BackupModSelectModal from './BackupModSelectModal';
import BackupRestoreModal from './BackupRestoreModal';

export default function BackupTab() {
  const bk = useBackupActions();

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8 bg-[#111827]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3 bg-white/2">
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <HardDrive className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-sm">النسخ الاحتياطي والاستعادة</p>
          <p className="text-white/30 text-xs">{bk.lastBackupLabel()}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-emerald-400/60" />
          <span className="text-emerald-400/60 text-[10px] font-medium">محمي</span>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-white/5">
        {([
          ['local',  <Download className="w-3.5 h-3.5" />,  'نسخ محلي',  'على جهازك'   ],
          ['server', <Server className="w-3.5 h-3.5" />,    'خادم SaaS', 'تلقائي ومجدول'],
        ] as const).map(([id, icon, label, sub]) => (
          <button
            key={id}
            onClick={() => bk.setBkMode(id)}
            className={`flex-1 flex items-center gap-2 px-4 py-3 text-right transition-all border-b-2 ${bk.bkMode === id ? 'border-amber-400 bg-amber-500/5' : 'border-transparent hover:bg-white/3'}`}
          >
            <span className={bk.bkMode === id ? 'text-amber-400' : 'text-white/30'}>{icon}</span>
            <div>
              <p className={`text-sm font-bold ${bk.bkMode === id ? 'text-amber-400' : 'text-white/50'}`}>{label}</p>
              <p className="text-white/25 text-xs">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {bk.bkMode === 'local' && (
        <BackupLocalTab
          bkModules={bk.bkModules}
          bkLoading={bk.bkLoading}
          bkProgress={bk.bkProgress}
          bkResult={bk.bkResult}
          compBusy={bk.compBusy}
          compResult={bk.compResult}
          autoSettings={bk.autoSettings}
          restoreFileRef={bk.restoreFileRef}
          restoreLoading={bk.restoreLoading}
          restoreResult={bk.restoreResult}
          restoreError={bk.restoreError}
          onLocalBackup={() => void bk.handleLocalBackup()}
          onToggleModule={bk.toggleModule}
          onToggleAll={bk.toggleAll}
          onComprehensiveBackup={() => void bk.handleComprehensiveBackup()}
          onSaveAutoSettings={bk.saveAutoSettings}
          onRestoreFile={bk.handleRestoreFile}
        />
      )}

      {bk.bkMode === 'server' && (
        <BackupServerTab
          schedule={bk.schedule}
          lastScheduled={bk.lastScheduled}
          onLogin={bk.onLogin}
          onLogout={bk.onLogout}
          schedSaving={bk.schedSaving}
          serverBkBusy={bk.serverBkBusy}
          backupList={bk.backupList}
          listLoading={bk.listLoading}
          deletingId={bk.deletingId}
          onSaveSettings={(o) => void bk.handleSaveSettings(o)}
          onServerSave={() => void bk.handleServerSave()}
          onServerDownload={() => void bk.handleServerDownload()}
          onDeleteBackup={(id) => void bk.handleDeleteBackup(id)}
          onDownloadById={(id, fn) => void bk.handleDownloadById(id, fn)}
          onReloadList={() => void bk.loadList()}
        />
      )}

      {/* Modals */}
      {bk.showModSelect && (
        <BackupModSelectModal
          pending={bk.pending}
          availMods={bk.availMods}
          selectedRestoreMods={bk.selectedRestoreMods}
          onToggleMod={(key) =>
            bk.setSelectedRestoreMods((prev) => {
              const s = new Set(prev);
              if (s.has(key)) s.delete(key); else s.add(key);
              return s;
            })
          }
          onToggleAll={() =>
            bk.setSelectedRestoreMods(
              bk.selectedRestoreMods.size === bk.availMods.length
                ? new Set()
                : new Set(bk.availMods)
            )
          }
          onClose={() => bk.setShowModSelect(false)}
          onContinue={() => { bk.setShowModSelect(false); bk.setModal(true); }}
        />
      )}

      {bk.modal && (
        <BackupRestoreModal
          pending={bk.pending}
          modalText={bk.modalText}
          understood={bk.understood}
          canConfirm={bk.canConfirm}
          onSetModalText={bk.setModalText}
          onToggleUnderstood={() => bk.setUnderstood((v) => !v)}
          onClose={() => bk.setModal(false)}
          onConfirm={() => void bk.handleConfirmRestore()}
        />
      )}
    </div>
  );
}
