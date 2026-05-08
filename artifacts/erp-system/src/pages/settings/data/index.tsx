import { useState } from 'react';
import { Database, Upload } from 'lucide-react';
import { useGetSettingsWarehouses } from '@workspace/api-client-react';
import { safeArray } from '@/lib/safe-data';
import { loadActivityLog } from './data-utils';
import { useProductsImport, usePurchasesImport } from './hooks/useImportActions';
import { useDangerActions } from './hooks/useDangerActions';
import ImportSection from './ImportSection';
import ActivityLogSection from './ActivityLogSection';
import DangerZoneSection from './DangerZoneSection';

export default function DataTab() {
  const [mainTab, setMainTab] = useState<'import' | 'danger'>('import');
  const [importTab, setImportTab] = useState<'products' | 'purchases'>('products');
  const [log, setLog] = useState(loadActivityLog);

  const { data: warehousesRaw } = useGetSettingsWarehouses();
  const warehousesList = safeArray(warehousesRaw) as { id: number; name: string }[];

  const refreshLog = () => setLog(loadActivityLog());

  const prodImport = useProductsImport(refreshLog);
  const purImport  = usePurchasesImport(refreshLog);
  const danger     = useDangerActions(warehousesList, refreshLog);

  return (
    <div className="space-y-4">
      {/* Main tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/3 border border-white/6">
        {([
          ['import', <Upload className="w-3.5 h-3.5" />,   'إدارة البيانات', 'استيراد وتصدير'],
          ['danger', <Database className="w-3.5 h-3.5" />, 'منطقة الخطر',    'مسح وإعادة تعيين'],
        ] as const).map(([id, icon, label, sub]) => (
          <button
            key={id}
            onClick={() => setMainTab(id)}
            className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-right transition-all ${mainTab === id ? 'bg-white/8 text-white' : 'text-white/40 hover:text-white/60'}`}
          >
            <span className={mainTab === id ? 'text-amber-400' : 'text-white/25'}>{icon}</span>
            <div>
              <p className={`text-xs font-bold ${mainTab === id ? 'text-white' : 'text-white/50'}`}>{label}</p>
              <p className="text-white/25 text-[10px]">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {mainTab === 'import' && (
        <>
          <ImportSection
            importTab={importTab}
            onSetImportTab={setImportTab}
            prodImporting={prodImport.prodImporting}
            prodExporting={prodImport.prodExporting}
            prodResult={prodImport.prodResult}
            prodRef={prodImport.prodRef}
            onExport={() => void prodImport.handleProductsExport()}
            onImport={prodImport.handleProductsImport}
            onDownloadProductTemplate={() => void prodImport.downloadProductsTemplate()}
            purRows={purImport.purRows}
            purParsed={purImport.purParsed}
            purLoading={purImport.purLoading}
            purConfirming={purImport.purConfirming}
            purResult={purImport.purResult}
            purSupplier={purImport.purSupplier}
            purPayType={purImport.purPayType}
            purRef={purImport.purRef}
            validRows={purImport.validRows}
            onPurchaseFile={purImport.handlePurchaseFile}
            onUpdatePurRow={purImport.updatePurRow}
            onPurchaseConfirm={() => void purImport.handlePurchaseConfirm()}
            onDownloadPurchaseTemplate={() => void purImport.downloadPurchaseTemplate()}
            onReset={purImport.resetPurchases}
            onSetPurSupplier={purImport.setPurSupplier}
            onSetPurPayType={purImport.setPurPayType}
          />

          <ActivityLogSection log={log} onClear={refreshLog} />
        </>
      )}

      {mainTab === 'danger' && (
        <DangerZoneSection
          selected={danger.selected}
          confirmText={danger.confirmText}
          clearBusy={danger.clearBusy}
          canDelete={danger.canDelete}
          delCount={danger.delCount}
          readyToDelete={danger.readyToDelete}
          resetText={danger.resetText}
          canReset={danger.canReset}
          resetCount={danger.resetCount}
          readyToReset={danger.readyToReset}
          resetDbPending={danger.resetDb.isPending}
          allKeys={danger.allKeys}
          selectedWarehouseId={danger.selectedWarehouseId}
          warehousesList={warehousesList}
          onToggle={danger.toggle}
          onToggleAll={danger.toggleAll}
          onClear={() => void danger.handleClear()}
          onResetFull={danger.handleResetFull}
          onSetConfirmText={danger.setConfirmText}
          onSetResetText={danger.setResetText}
          onSetSelectedWarehouseId={danger.setSelectedWarehouseId}
        />
      )}
    </div>
  );
}
