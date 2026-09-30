// Formatos devolvidos pela API. Valores monetários chegam como string decimal ("1500.00").

export type StageKey = "lead" | "qualification" | "proposal" | "negotiation" | "won" | "lost";

export interface UserSummary {
  id: number;
  username: string;
  name: string;
}

export interface Customer {
  id: number;
  name: string;
  document: string;
  email: string;
  phone: string;
}

export interface CustomerSummary extends Customer {
  open_count: number;
  won_count: number;
  open_amount: string;
}

export interface Opportunity {
  id: number;
  title: string;
  customer: Customer;
  owner: UserSummary;
  amount: string;
  stage: StageKey;
  stage_label: string;
  expected_close_date: string | null;
  lost_reason: string;
  erp_order_number: string | null;
  converted_at: string | null;
  is_converted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StageChange {
  from_stage: StageKey | "";
  to_stage: StageKey;
  changed_by: UserSummary | null;
  changed_at: string;
}

export interface OpportunityDetail extends Opportunity {
  stage_changes: StageChange[];
}

export interface OrderItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface Order {
  id: number;
  number: string;
  idempotency_key: string;
  status: string;
  status_label: string;
  customer_name: string;
  customer_document: string;
  total: string;
  items: OrderItem[];
  created_at: string;
}

export interface ConversionResult {
  order_number: string;
  created: boolean;
  opportunity: OpportunityDetail;
}
