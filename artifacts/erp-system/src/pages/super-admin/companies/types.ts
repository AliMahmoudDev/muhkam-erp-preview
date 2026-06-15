import type { Company, Stats, CompanyFeatures } from '../types';

export type ActiveTab =
  | 'overview'
  | 'companies'
  | 'managers'
  | 'settings'
  | 'revenue'
  | 'alerts'
  | 'announcements'
  | 'health'
  | 'plans'
  | 'monitoring'
  | 'audit_log';

export interface StatCard {
  label: string;
  value: number;
  icon: string;
  color: string;
  sub: string;
  filter: string | null;
  tab: ActiveTab;
}

export interface SubForm {
  plan_type: string;
  edition: 'advanced' | 'ultimate';
  extend_mode: 'days' | 'date';
  extend_days: number;
  end_date: string;
  is_active: boolean;
  features: CompanyFeatures;
}

export interface CreateResult {
  company_name: string;
  username: string;
  admin_name: string;
  temp_password: string;
}

export interface CoMutate {
  mutate: (
    args: { url: string; method?: string; body?: object },
    options?: { onSuccess?: (data: unknown) => void }
  ) => void;
  isPending: boolean;
}

export interface ResetPasswordMutate {
  mutate: (args: { id: number; company_name: string }) => void;
}

export interface TabCompaniesProps {
  stats: Stats | undefined;
  companies: Company[];
  filtered: Company[];
  paged: Company[];
  coLoading: boolean;
  coError: boolean;
  coFetching: boolean;
  coRefetch: () => void;
  coUpdatedAt: number;
  statCards: StatCard[];
  STATUS_FILTERS: { key: string; label: string }[];
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  setActiveTab: (t: ActiveTab) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  perPage: number;
  setPerPage: (v: number) => void;
  totalPages: number;
  safePage: number;
  viewMode: 'table' | 'cards';
  setViewMode: (v: 'table' | 'cards') => void;
  expandedId: number | null;
  setExpandedId: (v: number | null) => void;
  showCreate: boolean;
  setShowCreate: React.Dispatch<React.SetStateAction<boolean>>;
  newName: string;
  setNewName: (v: string) => void;
  newPlan: string;
  setNewPlan: (v: string) => void;
  newEdition: 'advanced' | 'ultimate';
  setNewEdition: (v: 'advanced' | 'ultimate') => void;
  newDays: number;
  setNewDays: (v: number) => void;
  newAdminName: string;
  setNewAdminName: (v: string) => void;
  newAdminUsername: string;
  setNewAdminUsername: (v: string) => void;
  setCreateResult: (v: CreateResult | null) => void;
  setSubModal: (v: Company | null) => void;
  setSubForm: React.Dispatch<React.SetStateAction<SubForm>>;
  setPanelTab: (v: 0 | 1 | 2 | 3) => void;
  setSnapshotCompany: (v: number | null) => void;
  setDeleteTarget: (v: Company | null) => void;
  setDeleteCoErr: (v: string) => void;
  DEFAULT_FEATS_ULTIMATE: CompanyFeatures;
  DEFAULT_FEATS_ADVANCED: CompanyFeatures;
  coMutate: CoMutate;
  resetPassword: ResetPasswordMutate;
  expiryInfo: (co: Company) => { text: string; color: string };
  showToast: (msg: string, type?: 'success' | 'error') => void;
}
