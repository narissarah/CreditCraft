/**
 * Customer related type definitions
 */

import { CreditType } from './credit';

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface CustomerType {
  id: string;
  shopifyCustomerId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  totalCredits?: number;
  activeCredits?: number;
  totalSpent?: number;
  shopDomain?: string;
  tags?: string[];
  credits?: CreditType[];
}

export interface CustomerSearchParams {
  page?: number;
  limit?: number;
  status?: CustomerStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  tag?: string;
  hasCreditBalance?: boolean;
}

export interface CustomerStats {
  totalCustomers: number;
  totalCustomersTrend: number;
  activeCustomers: number;
  activeCustomersTrend: number;
  newCustomers: number;
  newCustomersTrend: number;
  customerWithCredit: number;
  customerWithCreditTrend: number;
}

export interface CustomerAddress {
  id?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  isDefault?: boolean;
}

export interface CustomerImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{
    line: number;
    email: string;
    reason: string;
  }>;
} 