export interface Employee {
  id: number;
  company_id: number;
  employee_code: string;
  first_name_ar: string;
  last_name_ar: string;
  first_name_en: string;
  last_name_en: string;
  email?: string | null;
  phone?: string | null;
  personal_phone?: string | null;
  national_id?: string | null;
  national_id_image?: string | null;
  job_title_id?: number | null;
  department_id?: number | null;
  branch_id?: number | null;
  hire_date: string;
  employment_status: string;
  salary?: number | null;
  currency: string;
  salary_type?: 'fixed' | 'commission' | 'fixed_plus_commission';
  commission_rate?: number | null;
  commission_basis?: 'gross' | 'net' | null;
  commission_scope_dept_id?: number | null;
  bank_account?: string | null;
  address_ar?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  department_name?: string | null;
  job_title_name?: string | null;
  branch_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Department {
  id: number;
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
}

export interface JobTitle {
  id: number;
  name_ar: string;
  name_en: string;
}

export interface Branch {
  id: number;
  name: string;
  is_active: boolean;
}

export interface EmpDocument {
  id: number;
  document_type: string;
  file_name: string;
  expiry_date?: string | null;
  verified_at?: string | null;
  notes?: string | null;
  created_at?: string;
}

export type AnyRec = Record<string, unknown>;
export type SettleLine = { amount: string; category: string; description: string; date: string };
export type DetailTab = 'info' | 'loans' | 'deductions' | 'reports' | 'docs' | 'bonuses' | 'custody';
