/**
 * Prachurjo Host — Firestore Security Rules Test Suite (Dirty Dozen Verification)
 */
export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Self-Promoted Admin on Signup',
    collection: '/users/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { uid: 'user_1', role: 'ADMIN', status: 'ACTIVE' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-Tenant Draft File Read',
    collection: '/storage_objects/obj_draft_1',
    operation: 'get',
    auth: { uid: 'user_2', email: 'user2@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Negative Coin Balance Injection',
    collection: '/coin_wallets/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { userId: 'user_1', balance: -100, totalEarned: 100, totalSpent: 200 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Website Update',
    collection: '/websites/site_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { name: 'My Site', isFeaturedShadowField: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unverified Admin Email Spoof',
    collection: '/platform_settings/global',
    operation: 'update',
    auth: { uid: 'spoof_uid', email: 'prachurjosorkarporosh@gmail.com', email_verified: false },
    payload: { publishPriceCoins: 0 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Ledger History Tampering',
    collection: '/coin_transactions/tx_1',
    operation: 'delete',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Audit Log Deletion by Admin',
    collection: '/admin_audit_logs/log_1',
    operation: 'delete',
    auth: { uid: 'admin_1', email: 'prachurjosorkarporosh@gmail.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning with Special Characters',
    collection: '/websites/bad$id!@#',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { id: 'bad$id!@#', userId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Timestamp Forgery on Website Create',
    collection: '/websites/site_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { id: 'site_1', userId: 'user_1', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Cross-Tenant Website Ownership Transfer',
    collection: '/websites/site_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { userId: 'user_2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unauthorized Redeem Code Creation',
    collection: '/redeem_codes/FREE9999',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { id: 'FREE9999', code: 'FREE9999', coinAmount: 9999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'PII Blanket User Scraping',
    collection: '/users',
    operation: 'list',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
