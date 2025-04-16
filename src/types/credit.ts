export interface Transaction {
  id: string;
  type: 'ISSUE' | 'REDEEM' | 'ADJUST_UP' | 'ADJUST_DOWN' | 'CANCEL' | 'EXPIRE';
  amount: number;
  balanceAfter: number;
  createdAt: string;
  updatedAt: string;
  note?: string;
  staffId?: string;
  staffName?: string;
  orderId?: string;
  locationId?: string;
  locationName?: string;
}

export interface CreditType {
  id: string;
  code: string;
  amount: number;
  balance: number;
  currency: string;
  status: 'ACTIVE' | 'REDEEMED' | 'CANCELLED' | 'EXPIRED';
  expirationDate: string | null;
  createdAt: string;
  updatedAt: string;
  shopId: string;
  customerId?: string;
  note?: string;
  transactions?: Transaction[];
}

export interface CreditFilterParams {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface CreditStats {
  totalCredits: number;
  totalCreditsTrend: number;
  activeCredits: number;
  activeCreditsTrend: number;
  redeemedCredits: number;
  redeemedCreditsTrend: number;
  expiredCredits: number;
  expiredCreditsTrend: number;
} 