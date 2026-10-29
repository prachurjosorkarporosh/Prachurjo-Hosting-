export type Language = 'en' | 'bn';

export type UserRole = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export type WebsiteStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type WebsiteVisibility = 'PUBLIC' | 'UNLISTED';

export type DomainType = 'SUBDOMAIN' | 'CUSTOM';
export type DomainVerificationStatus = 'VERIFIED' | 'PENDING' | 'FAILED';

export type TransactionType =
  | 'REGISTRATION_BONUS'
  | 'DAILY_REWARD'
  | 'WEBSITE_PUBLISH'
  | 'WEBSITE_RENAME'
  | 'DOMAIN_CHANGE'
  | 'STORAGE_UPGRADE'
  | 'REDEEM_REWARD'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
  | 'REFUND';

export type NotificationCategory = 'PUBLISH' | 'WALLET' | 'SECURITY' | 'DOMAIN' | 'SYSTEM';

export type StarterTemplateId = 'blank' | 'portfolio' | 'saas' | 'linkbio';

export type UserDashboardTab =
  | 'overview'
  | 'websites'
  | 'create'
  | 'upload'
  | 'editor'
  | 'domains'
  | 'files'
  | 'wallet'
  | 'redeem'
  | 'storage'
  | 'notifications'
  | 'activity'
  | 'profile'
  | 'settings'
  | 'help';

export type AdminDashboardTab =
  | 'admin-overview'
  | 'admin-users'
  | 'admin-websites'
  | 'admin-domains'
  | 'admin-coins'
  | 'admin-redeem'
  | 'admin-storage'
  | 'admin-reports'
  | 'admin-audit'
  | 'admin-settings';

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  status: AccountStatus;
  storageQuotaBytes: number;
  storageUsedBytes: number;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Website {
  id: string;
  userId: string;
  ownerUsername: string;
  name: string;
  slug: string;
  description: string;
  visibility: WebsiteVisibility;
  entryFile: string;
  status: WebsiteStatus;
  primaryHostname: string;
  storageBytes: number;
  publishedVersionId: string;
  currentVersionNumber: number;
  createdAt: any;
  updatedAt: any;
}

export interface DomainRecord {
  id: string;
  websiteId: string;
  userId: string;
  hostname: string;
  domainType: DomainType;
  verificationStatus: DomainVerificationStatus;
  verificationToken: string;
  isPrimary: boolean;
  createdAt: any;
}

export interface WebsiteVersion {
  id: string;
  websiteId: string;
  userId: string;
  versionNumber: number;
  storagePrefix: string;
  deploymentStatus: 'PUBLISHED' | 'SUPERSEDED' | 'FAILED';
  fileCount: number;
  totalBytes: number;
  createdAt: any;
}

export interface StorageObject {
  id: string;
  userId: string;
  websiteId: string;
  versionId: string; // 'draft' or published version ID
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: string;
  isPublic: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface CoinWallet {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastDailyRewardAt: string;
  updatedAt: any;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  transactionType: TransactionType;
  referenceId: string;
  idempotencyKey: string;
  description: string;
  createdAt: any;
}

export interface RedeemCode {
  id: string;
  code: string;
  codeHash: string;
  coinAmount: number;
  maxRedemptions: number;
  perUserLimit: number;
  currentRedemptions: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: any;
}

export interface RedeemRedemption {
  id: string;
  redeemCodeId: string;
  code: string;
  userId: string;
  coinAmount: number;
  coinTransactionId: string;
  createdAt: any;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  isRead: boolean;
  createdAt: any;
}

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  metadataSummary: string;
  createdAt: any;
}

export interface PlatformSettings {
  platformName: string;
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  publishingEnabled: boolean;
  coinSystemEnabled: boolean;
  maxWebsitesPerUser: number;
  uploadSizeLimitMb: number;
  defaultStorageQuotaBytes: number;
  registrationBonusCoins: number;
  publishPriceCoins: number;
  renamePriceCoins: number;
  domainChangePriceCoins: number;
  dailyRewardCoins: number;
  storageUpgradePriceCoins: number;
  updatedAt?: any;
}
