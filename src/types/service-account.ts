export type ManagedServiceAccount = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  tokens_count: number;
  active_tokens_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type ServiceAccountIndexResponse = {
  service_accounts: ManagedServiceAccount[];
};

export type ServiceAccountMutationResponse = {
  service_account: ManagedServiceAccount;
};
