export interface FixedAsset {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  purchase_date: string;
  purchase_cost: number;
  residual_value: number;
  useful_life_months: number;
  depreciation_method: string;
  accumulated_depreciation: number;
  book_value: number;
  status: string;
  disposal_date: string | null;
  disposal_proceeds: number | null;
}

export interface ScheduleRow {
  period: string;
  depreciation: number;
  accumulated: number;
  book_value: number;
}

export interface DeprecRunRow {
  id: number;
  period: string;
  amount: number;
  entry_id: number | null;
}

export interface AssetDetail extends FixedAsset {
  schedule: ScheduleRow[];
  runs: DeprecRunRow[];
}
