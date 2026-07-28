export type ServiceAccount = {
  id: number;
  name: string;
  email: string;
  is_active?: boolean;
};

export type ApiToken = {
  id: number;
  name: string;
  abilities: string[];
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  status: 'active' | 'expired';
  service_account: ServiceAccount | null;
};

export type ApiTokenAbility = {
  value: string;
  label: string;
};

export type ApiTokenIndexResponse = {
  tokens: ApiToken[];
  service_accounts: ServiceAccount[];
  available_abilities: ApiTokenAbility[];
  default_expiration_days: number;
};

export type ApiTokenMutationResponse = {
  token: ApiToken;
  plain_text_token: string;
  replaces_token_id?: number;
};
