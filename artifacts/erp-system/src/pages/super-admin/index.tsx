/**
 * Super Admin Dashboard — thin orchestrator (~270 lines)
 * All business logic lives in custom hooks; JSX panels/modals are separate components.
 * Only accessible to users with role = "super_admin"
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useLocation } from 'wouter';
import { type Stats, type ActiveTab, C, FONT } from './types';
import { Toast } from './ui';
import { TabOverview } from './tab-overview';
import { TabRevenue } from './tab-revenue';
import { TabAlerts } from './tab-alerts';
import { TabAuditLog } from './tab-audit-log';
import { TabAnnouncements } from './tab-announcements';
import { TabHealth } from './tab-health';
import { TabPlans } from './tab-plans';
import { TabMonitoring } from './tab-monitoring';
import { TabCompanies } from './companies';
import { TabManagers } from './tab-managers';
import { TabSettings } from './tab-settings';
import { SAHeader } from './layout/sa-header';
import { SANav } from './layout/sa-nav';
import { CompanyPanel } from './panels/company-panel';
import { CompanyModals } from './modals/company-modals';
import { ManagerModals } from './modals/manager-modals';
import { SnapshotModal } from './modals/snapshot-modal';
import { useCompanyState } from './use-company-state';
import { useManagerState } from './use-manager-state';
import { useSettingsState } from './use-settings-state';
import { useTabsData } from './use-tabs-data';
import { StatusError, saRetry } from './sa-query';

/* ══════════════════════════════════════════════════
   MAIN COMPONENT — thin orchestrator
   ══════════════════════════════════════════════════ */
export default function SuperAdmin() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.role !== 'super_admin') setLocation('/');
  }, [user, setLocation]);

  /* ── Cross-cutting state ── */
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  /* ── Shared stats query (used by TabOverview + TabCompanies) ── */
  const { data: stats } = useQuery<Stats>({
    queryKey: queryKeys.super.stats,
    queryFn: async () => {
      const r = await authFetch(api('/api/super/stats'));
      if (!r.ok) {
        let detail = '';
        try {
          const b = await r.json();
          detail = b?.error || b?.message || '';
        } catch {
          /* ignore */
        }
        throw new StatusError(r.status, detail || `HTTP ${r.status}`);
      }
      return r.json() as Promise<Stats>;
    },
    staleTime: 30_000,
    retry: saRetry,
    refetchOnWindowFocus: false,
  });

  /* ── Custom hooks ── */
  const co = useCompanyState(stats, showToast);
  const mgr = useManagerState(showToast);
  const st = useSettingsState(showToast, activeTab);
  const td = useTabsData(activeTab, st.settingsActiveCard, showToast);

  if (!user || user.role !== 'super_admin') return null;

  return (
    <div
      dir="rtl"
      style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT, color: C.text }}
    >
      {/* ── Global Modals ── */}
      <CompanyModals
        createResult={co.createResult}
        setCreateResult={co.setCreateResult}
        showToast={showToast}
        resetPassResult={co.resetPassResult}
        setResetPassResult={co.setResetPassResult}
        resetPassCopied={co.resetPassCopied}
        setResetPassCopied={co.setResetPassCopied}
        deleteTarget={co.deleteTarget}
        setDeleteTarget={co.setDeleteTarget}
        deleteStep={co.deleteStep}
        setDeleteStep={co.setDeleteStep}
        deleteCoErr={co.deleteCoErr}
        setDeleteCoErr={co.setDeleteCoErr}
        generatedCode={co.generatedCode}
        setGeneratedCode={co.setGeneratedCode}
        enteredCode={co.enteredCode}
        setEnteredCode={co.setEnteredCode}
        coDelete={co.coDelete}
      />

      <ManagerModals
        showAddMgr={mgr.showAddMgr}
        setShowAddMgr={mgr.setShowAddMgr}
        editMgr={mgr.editMgr}
        setEditMgr={mgr.setEditMgr}
        deleteMgr={mgr.deleteMgr}
        setDeleteMgr={mgr.setDeleteMgr}
        deleteMgrErr={mgr.deleteMgrErr}
        setDeleteMgrErr={mgr.setDeleteMgrErr}
        mgName={mgr.mgName}
        setMgName={mgr.setMgName}
        mgUser={mgr.mgUser}
        setMgUser={mgr.setMgUser}
        mgPin={mgr.mgPin}
        setMgPin={mgr.setMgPin}
        mgPin2={mgr.mgPin2}
        setMgPin2={mgr.setMgPin2}
        mgErr={mgr.mgErr}
        eName={mgr.eName}
        setEName={mgr.setEName}
        eUser={mgr.eUser}
        setEUser={mgr.setEUser}
        ePin={mgr.ePin}
        setEPin={mgr.setEPin}
        ePin2={mgr.ePin2}
        setEPin2={mgr.setEPin2}
        eErr={mgr.eErr}
        handleAddMgr={mgr.handleAddMgr}
        handleEditMgr={mgr.handleEditMgr}
        resetAddForm={mgr.resetAddForm}
        resetEditForm={mgr.resetEditForm}
        mgCreatePending={mgr.mgCreate.isPending}
        mgUpdatePending={mgr.mgUpdate.isPending}
        mgDeleteMutate={mgr.mgDelete.mutate}
        mgDeletePending={mgr.mgDelete.isPending}
      />

      <SnapshotModal
        snapshotCompany={co.snapshotCompany}
        setSnapshotCompany={co.setSnapshotCompany}
        snapshotData={co.snapshotData}
        snapshotLoading={co.snapshotLoading}
      />

      <CompanyPanel
        subModal={co.subModal}
        setSubModal={co.setSubModal}
        panelTab={co.panelTab}
        setPanelTab={co.setPanelTab}
        subForm={co.subForm}
        setSubForm={co.setSubForm}
        subSaving={co.subSaving}
        saveSubscription={co.saveSubscription}
        panelCompanyDetail={co.panelCompanyDetail}
        panelDetailLoading={co.panelDetailLoading}
        panelAuditResp={co.panelAuditResp}
        panelAuditLoading={co.panelAuditLoading}
        coMutate={co.coMutate}
        resetPassword={co.resetPassword}
        setSnapshotCompany={co.setSnapshotCompany}
        setDeleteTarget={co.setDeleteTarget}
        setDeleteCoErr={co.setDeleteCoErr}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── Sticky Header ── */}
      <SAHeader today={today} redisHealth={td.redisHealth} logout={logout} />

      {/* ── Main Content ── */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
        <SANav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* ── Tabs ── */}
        {activeTab === 'overview' && (
          <TabOverview
            healthData={td.healthData}
            healthLoading={td.healthLoading}
            stats={stats}
            overviewAudit={td.overviewAudit}
            setActiveTab={setActiveTab}
            setStatusFilter={co.setStatusFilter}
            setSettingsActiveCard={st.setSettingsActiveCard}
          />
        )}

        {activeTab === 'companies' && (
          <TabCompanies
            stats={stats}
            companies={co.companies}
            filtered={co.filtered}
            paged={co.paged}
            coLoading={co.coLoading}
            coError={co.coError}
            coFetching={co.coFetching}
            coRefetch={() => void co.coRefetch()}
            coUpdatedAt={co.coUpdatedAt}
            statCards={co.statCards}
            STATUS_FILTERS={co.STATUS_FILTERS}
            search={co.search}
            setSearch={co.setSearch}
            statusFilter={co.statusFilter}
            setStatusFilter={co.setStatusFilter}
            setActiveTab={setActiveTab}
            page={co.page}
            setPage={co.setPage}
            perPage={co.perPage}
            setPerPage={co.setPerPage}
            totalPages={co.totalPages}
            safePage={co.safePage}
            viewMode={co.viewMode}
            setViewMode={co.setViewMode}
            expandedId={co.expandedId}
            setExpandedId={co.setExpandedId}
            showCreate={co.showCreate}
            setShowCreate={co.setShowCreate}
            newName={co.newName}
            setNewName={co.setNewName}
            newPlan={co.newPlan}
            setNewPlan={co.setNewPlan}
            newEdition={co.newEdition}
            setNewEdition={co.setNewEdition}
            newDays={co.newDays}
            setNewDays={co.setNewDays}
            newAdminName={co.newAdminName}
            setNewAdminName={co.setNewAdminName}
            newAdminUsername={co.newAdminUsername}
            setNewAdminUsername={co.setNewAdminUsername}
            setCreateResult={co.setCreateResult}
            setSubModal={co.setSubModal}
            setSubForm={co.setSubForm}
            setPanelTab={co.setPanelTab}
            setSnapshotCompany={co.setSnapshotCompany}
            setDeleteTarget={co.setDeleteTarget}
            setDeleteCoErr={co.setDeleteCoErr}
            DEFAULT_FEATS_ULTIMATE={co.DEFAULT_FEATS_ULTIMATE}
            DEFAULT_FEATS_ADVANCED={co.DEFAULT_FEATS_ADVANCED}
            coMutate={co.coMutate}
            resetPassword={co.resetPassword}
            expiryInfo={co.expiryInfo}
            showToast={showToast}
          />
        )}

        {activeTab === 'managers' && (
          <TabManagers
            managers={mgr.managers}
            mgLoading={mgr.mgLoading}
            mgError={mgr.mgError}
            mgRefetch={mgr.mgRefetch}
            currentUserId={user?.id}
            mgToggleMutate={(id) => mgr.mgToggle.mutate(id)}
            openEdit={mgr.openEdit}
            setDeleteMgrErr={mgr.setDeleteMgrErr}
            setDeleteMgr={mgr.setDeleteMgr}
            resetAddForm={mgr.resetAddForm}
            setShowAddMgr={mgr.setShowAddMgr}
          />
        )}

        {activeTab === 'settings' && (
          <TabSettings
            settingsActiveCard={st.settingsActiveCard}
            setSettingsActiveCard={st.setSettingsActiveCard}
            supportWa={st.supportWa}
            setSupportWa={st.setSupportWa}
            supportEmail={st.supportEmail}
            setSupportEmail={st.setSupportEmail}
            settingSaving={st.settingSaving}
            saveSupportSettings={st.saveSupportSettings}
            backupData={st.backupData}
            creatingBackup={st.creatingBackup}
            downloadingFile={st.downloadingFile}
            restoring={st.restoring}
            restoreOk={st.restoreOk}
            restoreErr={st.restoreErr}
            triggerBackup={st.triggerBackup}
            downloadBackup={st.downloadBackup}
            openRestorePicker={st.openRestorePicker}
            restoreInputRef={st.restoreInputRef}
            handleRestoreFileChange={st.handleRestoreFileChange}
            restoreModal={st.restoreModal}
            setRestoreModal={st.setRestoreModal}
            pendingRestoreFile={st.pendingRestoreFile}
            setPendingRestoreFile={st.setPendingRestoreFile}
            restoreCode={st.restoreCode}
            setRestoreCode={st.setRestoreCode}
            confirmRestore={st.confirmRestore}
            encEnabled={st.encEnabled}
            showKeyGen={st.showKeyGen}
            setShowKeyGen={st.setShowKeyGen}
            keyGenPin={st.keyGenPin}
            setKeyGenPin={st.setKeyGenPin}
            keyGenLoading={st.keyGenLoading}
            keyGenError={st.keyGenError}
            generatedKey={st.generatedKey}
            keyGenAlreadyConfigured={st.keyGenAlreadyConfigured}
            keyGenCopied={st.keyGenCopied}
            setKeyGenCopied={st.setKeyGenCopied}
            generateEncryptionKey={st.generateEncryptionKey}
            dismissGeneratedKey={st.dismissGeneratedKey}
            totpStatus={st.totpStatus}
            totpSetupData={st.totpSetupData}
            totpInput={st.totpInput}
            setTotpInput={st.setTotpInput}
            disableTotpInput={st.disableTotpInput}
            setDisableTotpInput={st.setDisableTotpInput}
            secLoading={st.secLoading}
            secMsg={st.secMsg}
            setSecMsg={st.setSecMsg}
            showDisable={st.showDisable}
            setShowDisable={st.setShowDisable}
            startTotpSetup={st.startTotpSetup}
            confirmTotpSetup={st.confirmTotpSetup}
            confirmDisableTotp={st.confirmDisableTotp}
            auditData={td.auditData}
            auditLoading={td.auditLoading}
            refetchAudit={td.refetchAudit}
            auditAction={td.auditAction}
            setAuditAction={td.setAuditAction}
            auditLimit={td.auditLimit}
            setAuditLimit={td.setAuditLimit}
            tgConfig={st.tgConfig}
            setTgConfig={st.setTgConfig}
            tgSaving={st.tgSaving}
            tgBotStatus={st.tgBotStatus}
            tgBotLoading={st.tgBotLoading}
            tgBotRefetch={st.tgBotRefetch}
            tgLoading={st.tgLoading}
            tgError={st.tgError}
            tgErrorObj={st.tgErrorObj}
            tgRefetch={st.tgRefetch}
            tgBotToken={st.tgBotToken}
            setTgBotToken={st.setTgBotToken}
            tgChatId={st.tgChatId}
            setTgChatId={st.setTgChatId}
            tgShowToken={st.tgShowToken}
            setTgShowToken={st.setTgShowToken}
            tgCredSaving={st.tgCredSaving}
            saveTgCredentials={st.saveTgCredentials}
            tgTesting={st.tgTesting}
            testTelegramConnection={st.testTelegramConnection}
            tgTestResult={st.tgTestResult}
            saveTelegramSettings={st.saveTelegramSettings}
          />
        )}

        {activeTab === 'revenue' && (
          <TabRevenue
            revenueData={td.revenueData}
            revenueLoading={td.revenueLoading}
            revenueError={!!td.revenueError}
            onRefetch={() => void td.refetchRevenue()}
            onExportCSV={co.exportCompaniesCSV}
          />
        )}

        {activeTab === 'alerts' && (
          <TabAlerts
            alertsData={td.alertsData}
            alertsLoading={td.alertsLoading}
            alertsError={!!td.alertsError}
            onRefetch={() => void td.refetchAlerts()}
            alertSearch={td.alertSearch}
            setAlertSearch={td.setAlertSearch}
            alertTypeFilter={td.alertTypeFilter}
            setAlertTypeFilter={td.setAlertTypeFilter}
            setActiveTab={setActiveTab}
            setSnapshotCompany={co.setSnapshotCompany}
          />
        )}

        {activeTab === 'audit_log' && (
          <TabAuditLog
            auditData={td.auditData}
            auditLoading={td.auditLoading}
            auditError={!!td.auditError}
            onRefetch={() => void td.refetchAudit()}
            auditAction={td.auditAction}
            setAuditAction={td.setAuditAction}
            auditLimit={td.auditLimit}
            setAuditLimit={td.setAuditLimit}
          />
        )}

        {activeTab === 'announcements' && (
          <TabAnnouncements
            annData={td.annData}
            annType={td.annType}
            setAnnType={td.setAnnType}
            annTarget={td.annTarget}
            setAnnTarget={td.setAnnTarget}
            annCompanyId={td.annCompanyId}
            setAnnCompanyId={td.setAnnCompanyId}
            annTitle={td.annTitle}
            setAnnTitle={td.setAnnTitle}
            annBody={td.annBody}
            setAnnBody={td.setAnnBody}
            annExpires={td.annExpires}
            setAnnExpires={td.setAnnExpires}
            annSaving={td.annSaving}
            onSave={td.saveAnnouncement}
            onToggle={td.toggleAnn}
            onDelete={td.deleteAnn}
          />
        )}

        {activeTab === 'health' && (
          <TabHealth
            healthData={td.healthData}
            healthLoading={td.healthLoading}
            healthError={!!td.healthError}
            onRefetch={td.refetchHealth}
            healthUpdated={td.healthUpdated}
            redisHealth={td.redisHealth}
          />
        )}

        {activeTab === 'plans' && (
          <TabPlans
            planSettings={td.planSettings}
            planSettingsLoading={td.planSettingsLoading}
            planSettingsError={!!td.planSettingsError}
            onRefetch={() => void td.refetchPlans()}
            editingPlan={td.editingPlan}
            setEditingPlan={td.setEditingPlan}
            planSaving={td.planSaving}
            onSavePlan={td.savePlan}
          />
        )}

        {activeTab === 'monitoring' && (
          <TabMonitoring
            monData={td.monData}
            monLoading={td.monLoading}
            monError={!!td.monError}
            onRefetch={() => void td.refetchMon()}
            unblockIP={td.unblockIP}
            setUnblockIP={td.setUnblockIP}
            unblockEmail={td.unblockEmail}
            setUnblockEmail={td.setUnblockEmail}
            unblockResult={td.unblockResult}
            setUnblockResult={td.setUnblockResult}
            unblockLoading={td.unblockLoading}
            setUnblockLoading={td.setUnblockLoading}
            unblockMsg={td.unblockMsg}
            setUnblockMsg={td.setUnblockMsg}
          />
        )}
      </div>

      <style>{`
        @keyframes sa-fade-in  { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes sa-panel-in { from { opacity:0; transform:translateY(-10px) scaleY(0.97); transform-origin:top; } to { opacity:1; transform:translateY(0) scaleY(1); transform-origin:top; } }
        @keyframes sa-shimmer  { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
        @keyframes sa-spin     { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
