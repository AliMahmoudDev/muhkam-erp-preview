import { C, FONT } from '../types';
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
    stats,
    companies,
    filtered,
    paged,
    coLoading,
    coError,
    coFetching,
    coRefetch,
    coUpdatedAt,
    statCards,
    STATUS_FILTERS,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    setActiveTab,
    page: _page,
    setPage,
    perPage,
    setPerPage,
    totalPages,
    safePage,
    viewMode,
    setViewMode,
    expandedId,
    setExpandedId,
    showCreate,
    setShowCreate,
    newName,
    setNewName,
    newPlan,
    setNewPlan,
    newEdition,
    setNewEdition,
    newDays,
    setNewDays,
    newAdminName,
    setNewAdminName,
    newAdminUsername,
    setNewAdminUsername,
    setCreateResult,
    setSubModal,
    setSubForm,
    setPanelTab,
    setSnapshotCompany,
    setDeleteTarget,
    setDeleteCoErr,
    DEFAULT_FEATS_ULTIMATE,
    DEFAULT_FEATS_ADVANCED,
    coMutate,
    resetPassword,
    expiryInfo,
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
          background: C.card,
          borderRadius: '20px',
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>
              الشركات المسجّلة
            </h2>
            <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>
              {coError
                ? 'تعذّر تحميل القائمة'
                : `عرض ${filtered.length} من ${companies.length} شركة${
                    coUpdatedAt
                      ? ` · آخر تحديث ${new Date(coUpdatedAt).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}`
                      : ''
                  }`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => coRefetch()}
              disabled={coFetching}
              title="تحديث القائمة"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                background: 'transparent',
                color: C.muted,
                border: `1px solid ${C.border}`,
                fontSize: '13px',
                fontWeight: 700,
                cursor: coFetching ? 'default' : 'pointer',
                opacity: coFetching ? 0.6 : 1,
                fontFamily: FONT,
                transition: 'all 0.18s',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  animation: coFetching ? 'sa-spin 0.8s linear infinite' : 'none',
                }}
              >
                ⟳
              </span>
              <span>تحديث</span>
            </button>
            <button
              onClick={() => setShowCreate((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: showCreate ? 'transparent' : C.orange,
                color: showCreate ? C.muted : 'var(--text-1)',
                border: showCreate ? `1px solid ${C.border}` : 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
                transition: 'all 0.18s',
              }}
            >
              <span style={{ fontSize: '15px' }}>{showCreate ? '✕' : '+'}</span>
              <span>{showCreate ? 'إلغاء' : 'شركة جديدة'}</span>
            </button>
          </div>
        </div>

        <CompaniesToolbar
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          STATUS_FILTERS={STATUS_FILTERS}
          perPage={perPage}
          setPerPage={setPerPage}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        {showCreate && (
          <CreateCompanyForm
            newName={newName}
            setNewName={setNewName}
            newPlan={newPlan}
            setNewPlan={setNewPlan}
            newEdition={newEdition}
            setNewEdition={setNewEdition}
            newDays={newDays}
            setNewDays={setNewDays}
            newAdminName={newAdminName}
            setNewAdminName={setNewAdminName}
            newAdminUsername={newAdminUsername}
            setNewAdminUsername={setNewAdminUsername}
            setShowCreate={setShowCreate}
            setCreateResult={setCreateResult}
            coMutate={coMutate}
          />
        )}

        {/* Table / Cards body */}
        {coLoading ? (
          <div style={{ padding: '24px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: '44px',
                  borderRadius: '10px',
                  marginBottom: '10px',
                  background: `linear-gradient(90deg, ${C.bg} 25%, rgba(255,255,255,0.05) 37%, ${C.bg} 63%)`,
                  backgroundSize: '400% 100%',
                  animation: 'sa-shimmer 1.4s ease infinite',
                }}
              />
            ))}
          </div>
        ) : coError ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div
              style={{ color: C.danger, fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}
            >
              تعذّر جلب قائمة الشركات
            </div>
            <div style={{ color: C.muted, fontSize: '13px', marginBottom: '18px' }}>
              قد يكون الخادم غير متاح أو انتهت جلستك — حاول مرة أخرى.
            </div>
            <button
              onClick={() => coRefetch()}
              style={{
                padding: '9px 22px',
                borderRadius: '10px',
                background: C.orange,
                color: 'var(--text-1)',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        ) : paged.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
            {search || statusFilter !== 'all'
              ? 'لا توجد نتائج مطابقة للبحث'
              : 'لا توجد شركات مسجّلة بعد'}
          </div>
        ) : viewMode === 'cards' ? (
          <div
            style={{
              padding: '16px 24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '14px',
            }}
          >
            {paged.map((co) => (
              <CompanyCard
                key={co.id}
                co={co}
                expiryInfo={expiryInfo}
                setPanelTab={setPanelTab}
                setSubModal={setSubModal}
                setSubForm={setSubForm}
                setSnapshotCompany={setSnapshotCompany}
                setDeleteTarget={setDeleteTarget}
                setDeleteCoErr={setDeleteCoErr}
                DEFAULT_FEATS_ULTIMATE={DEFAULT_FEATS_ULTIMATE}
              />
            ))}
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr 100px 150px 60px 60px 24px',
                gap: '8px',
                padding: '10px 24px',
                background: 'rgba(249,115,22,0.08)',
                borderBottom: `1px solid ${C.border}`,
                fontSize: '11px',
                fontWeight: 700,
                color: C.orange,
                alignItems: 'center',
              }}
            >
              <div>#</div>
              <div>الشركة</div>
              <div style={{ textAlign: 'center' }}>الحالة</div>
              <div>تاريخ الانتهاء</div>
              <div style={{ textAlign: 'center' }}>مستخدمين</div>
              <div style={{ textAlign: 'center' }}>الخطة</div>
              <div />
            </div>
            {paged.map((co, idx) => (
              <CompanyTableRow
                key={co.id}
                co={co}
                idx={idx}
                isExpanded={expandedId === co.id}
                setExpandedId={setExpandedId}
                expiryInfo={expiryInfo}
                coMutate={coMutate}
                resetPassword={resetPassword}
                setPanelTab={setPanelTab}
                setSubModal={setSubModal}
                setSubForm={setSubForm}
                setDeleteTarget={setDeleteTarget}
                setDeleteCoErr={setDeleteCoErr}
                DEFAULT_FEATS_ULTIMATE={DEFAULT_FEATS_ULTIMATE}
                DEFAULT_FEATS_ADVANCED={DEFAULT_FEATS_ADVANCED}
              />
            ))}
          </div>
        )}

        {!coLoading && !coError && (
          <CompaniesPagination
            filtered={filtered}
            safePage={safePage}
            perPage={perPage}
            totalPages={totalPages}
            setPage={setPage}
          />
        )}
      </div>
    </>
  );
}
