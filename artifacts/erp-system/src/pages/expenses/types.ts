export interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string | null;
  safe_id: number | null;
  safe_name: string | null;
  created_at: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
}

export interface ExpenseReportRow {
  id: number;
  category: string;
  amount: number;
  description: string | null;
  safe_name: string | null;
  date: string;
}
