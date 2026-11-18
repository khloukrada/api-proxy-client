export type NbcExchangeRate = {
  id: number;
  rate_date: string;
  currency_pair: 'USD/KHR';
  unit: number;
  bid: number;
  ask: number;
  average: number;
  source: 'nbc' | 'manual';
  fetched_at: string | null;
  recorded_at: string;
  entered_by_name: string | null;
  note: string | null;
  version: string;
  decimal_values: { bid: string; ask: string; average: string };
};

export type NbcExchangeRateResponse = {
  latest: NbcExchangeRate | null;
  status: {
    state: 'fresh' | 'stale' | 'expired' | 'unavailable' | 'manual';
    stale: boolean;
    expired: boolean;
    publication_is_older: boolean;
    check_is_overdue: boolean;
  };
  as_of: string;
  history: {
    data: NbcExchangeRate[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

export type NbcRateConflict = {
  rate_date: string;
  unit: number;
  average: string;
  bid: string;
  ask: string;
  source: 'nbc' | 'manual';
  version: string;
};

export type NbcAuditRate = {
  unit: number;
  bid: string;
  ask: string;
  average: string;
  source: 'nbc' | 'manual';
  note: string | null;
};

export type NbcRateAudit = {
  id: number;
  rate_date: string;
  event:
    | 'manual_created'
    | 'manual_revised'
    | 'nbc_imported'
    | 'nbc_updated'
    | 'nbc_replaced_manual';
  actor: { type: 'administrator' | 'system' | 'unknown'; name: string | null };
  changed_at: string;
  previous_rate: NbcAuditRate | null;
  new_rate: NbcAuditRate;
  note: string | null;
};

export type NbcAuditResponse = {
  data: NbcRateAudit[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};
