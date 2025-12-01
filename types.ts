export enum ExpiryStatus {
  VALID = 'valid',
  WARNING = 'warning',
  EXPIRED = 'expired',
}

export interface Contract {
  id?: number;
  draudejas: string; // Client Name
  pardavejas: string; // Salesperson ID
  ldGrupe: string; // Insurance Type
  policyNo: string;
  galiojaNuo: string; // ISO Date
  galiojaIki: string; // ISO Date
  valstybinisNr: string; // Reg Number
  metineIsmoka: number; // Yearly Price
  ismoka: number; // Payout/Value
  notes: string[]; // Array of strings
  atnaujinimoData?: string; // Last Updated
  is_archived?: boolean;
}

export interface User {
  id?: number;
  username: string;
  isAdmin: boolean; // Legacy check, kept for convenience
  role: 'admin' | 'sales' | 'viewer';
}

export interface HistoryEntry {
  id: number;
  contract_id: number;
  user_id?: number;
  username: string;
  timestamp: string;
  action: string;
  details: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  assigned_to: string; // username
  created_by: string; // username
  status: 'pending' | 'completed';
  due_date?: string;
  created_at: string;
}