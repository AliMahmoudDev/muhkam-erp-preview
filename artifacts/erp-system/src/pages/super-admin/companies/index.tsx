import { C, FONT } from '../types';
import type { Company, CompanyFeatures } from '../types';
import type { TabCompaniesProps } from './types';
import { StatsCards } from './StatsCards';
import { ExpiringAlert } from './ExpiringAlert';
import { MonthlySignups } from './MonthlySignups';
import { CreateCompanyForm } from './CreateCompanyForm';
import { CompaniesToolbar } from './CompaniesToolbar';
import { CompanyCard } from './CompanyCard';
import { CompanyTableRow } from './CompanyTableRow';
import { CompaniesPagination } from './CompaniesPagination';

export function TabCompanies(props: TabCompaniesProps) {
  const {
    stats, companies, filtered, paged, coLoading,
    statCards, STATUS_FILTERS,
    search, setSearch, statusFilter, setStatusFilter, setActiveTab,
    page: _page, setPage, perPage, setPerPage, totalPages, safePage,
    viewMode, setViewMode, expandedId, setExpandedId,
    showCreate, setShowCreate,
    newName, setNewName, newPlan, setNewPlan,
    newEdition, setNewEdition, newDays, setNewDays,
    newAdminName, setNewAdminName, newAdminUsername, setNewAdminUsername,
    setCreateResult, setSubModal, setSubForm,
    setPanelTab, setSnapshotCompany, setDeleteTarget, setDeleteCoErr,
    DEFAULT_FEATS_ULTIMATE, DEFAULT_FEATS_ADVANCED,
    coMutate, resetPassword, expiryInfo,
  } = props;

  return (
    <>
      <StatsCards
        statCards={statCards}
        setActiveTab={setActiveTab}
        setStatusFilter={setStatusFilter}
      />

      {stats && <ExpiringAlert stats={stats} coMutate={coMutate} />}
      {stats && <MonthlySignups stats={stats} />}


      {/* Companies table card */}
      <div
        id="companies-table"
        style={{
          background: C.card, borderRadius: '20px',
          border: `1px solid ${C.border}`, overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', flexWrap: 'wrap',
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>
              الشركات المسجّلة
            </h2>
            <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>
              عرض {filtered.length} من {companies.length} شركة
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '10px',
              background: showCreate ? 'transparent' : C.orange,
              color: showCreate ? C.muted : '#fff',
              border: showCreate ? `1px solid ${C.border}` : 'none',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              transition: 'all 0.18s', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '15px' }}>{showCreate ? '✕' : '+'}</span>
            <span>{showCreate ? 'إلغاء' : 'شركة جديدة'}</span>
          </button>
        </div>

        <CompaniesToolbar
          search={search} setSearch={setSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          STATUS_FILTERS={STATUS_FILTERS}
          perPage={perPage} setPerPage={setPerPage}
          viewMode={viewMode} setViewMode={setViewMode}
        />

        {showCreate && (
          <CreateCompanyForm
            newName={newName} setNewName={setNewName}
            newPlan={newPlan} setNewPlan={setNewPlan}
            newEdition={newEdition} setNewEdition={setNewEdition}
            newDays={newDays} setNewDays={setNewDays}
            newAdminName={newAdminName} setNewAdminName={setNewAdminName}
            newAdminUsername={newAdminUsername} setNewAdminUsername={setNewAdminUsername}
            setShowCreate={setShowCreate} setCreateResult={setCreateResult}
            coMutate={coMutate}
          />
        )}


        {/* Table / Cards body */}
        {coLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>جاري التحميل...</div>
        ) : paged.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
            {search || statusFilter !== 'all' ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد شركات مسجّلة بعد'}
          </div>
        ) : viewMode === 'cards' ? (
          <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {paged.map((co) => (
              <CompanyCard
                key={co.id} co={co} expiryInfo={expiryInfo}
                setPanelTab={setPanelTab} setSubModal={setSubModal} setSubForm={setSubForm}
                setSnapshotCompany={setSnapshotCompany}
                setDeleteTarget={setDeleteTarget} setDeleteCoErr={setDeleteCoErr}
                DEFAULT_FEATS_ULTIMATE={DEFAULT_FEATS_ULTIMATE}
              />
            ))}
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '44px 1fr 100px 150px 60px 60px 24px',
              gap: '8px', padding: '10px 24px',
              background: 'rgba(249,115,22,0.08)', borderBottom: `1px solid ${C.border}`,
              fontSize: '11px', fontWeight: 700, color: C.orange, alignItems: 'center',
            }}>
              <div>#</div><div>الشركة</div>
              <div style={{ textAlign: 'center' }}>الحالة</div>
              <div>تاريخ الانتهاء</div>
              <div style={{ textAlign: 'center' }}>مستخدمين</div>
              <div style={{ textAlign: 'center' }}>الخطة</div><div />
            </div>
            {paged.map((co, idx) => (
              <CompanyTableRow
                key={co.id} co={co} idx={idx}
                isExpanded={expandedId === co.id}
                setExpandedId={setExpandedId}
                expiryInfo={expiryInfo} coMutate={coMutate} resetPassword={resetPassword}
                setPanelTab={setPanelTab} setSubModal={setSubModal} setSubForm={setSubForm}
                setDeleteTarget={setDeleteTarget} setDeleteCoErr={setDeleteCoErr}
                DEFAULT_FEATS_ULTIMATE={DEFAULT_FEATS_ULTIMATE}
                DEFAULT_FEATS_ADVANCED={DEFAULT_FEATS_ADVANCED}
              />
            ))}
          </div>
        )}

        {!coLoading && <CompaniesPagination filtered={filtered} safePage={safePage} perPage={perPage} totalPages={totalPages} setPage={setPage} />}
      </div>
    </>
  );
}
