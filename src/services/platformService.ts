import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ALLOWED_EXTENSIONS,
  getExtension,
  normalizeSlug,
  TemplateFileSeed,
  validateCustomDomainHostname,
  validateSafeFilePath,
  validateWebsiteSlug,
} from '../lib/templates';
import {
  AdminAuditLog,
  CoinTransaction,
  CoinWallet,
  DomainRecord,
  NotificationCategory,
  PlatformSettings,
  RedeemCode,
  StorageObject,
  TransactionType,
  UserProfile,
  Website,
  WebsiteVisibility,
} from '../types';

const BOOTSTRAP_ADMIN_EMAIL = 'prachurjosorkarporosh@gmail.com';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: 'Prachurjo Host',
  registrationEnabled: true,
  maintenanceMode: false,
  publishingEnabled: true,
  coinSystemEnabled: true,
  maxWebsitesPerUser: 10,
  uploadSizeLimitMb: 10,
  defaultStorageQuotaBytes: 52428800, // 50 MB
  registrationBonusCoins: 100,
  publishPriceCoins: 50,
  renamePriceCoins: 10,
  domainChangePriceCoins: 20,
  dailyRewardCoins: 5,
  storageUpgradePriceCoins: 40,
};

export function generateId(prefix = 'id'): string {
  const randomPart = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  return `${prefix}_${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function simpleCodeHash(code: string): string {
  const normalized = code.trim().toUpperCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }
  return `h_${(hash >>> 0).toString(16)}_${normalized.length}`;
}

export async function getOrInitPlatformSettings(): Promise<PlatformSettings> {
  const ref = doc(db, 'platform_settings', 'global');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as PlatformSettings;
    }
    return DEFAULT_PLATFORM_SETTINGS;
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export async function createNotificationRecord(
  userId: string,
  title: string,
  message: string,
  category: NotificationCategory
) {
  const id = generateId('notif');
  const ref = doc(db, 'notifications', id);
  try {
    await setDoc(ref, {
      id,
      userId,
      title: title.slice(0, 120),
      message: message.slice(0, 400),
      category,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Non-fatal notification error:', err);
  }
}

export async function ensureUserInitialized(
  firebaseUser: User,
  preferredUsername?: string
): Promise<{ profile: UserProfile; wallet: CoinWallet }> {
  const uid = firebaseUser.uid;
  const userRef = doc(db, 'users', uid);
  const walletRef = doc(db, 'coin_wallets', uid);

  try {
    const [userSnap, walletSnap, settings] = await Promise.all([
      getDoc(userRef),
      getDoc(walletRef),
      getOrInitPlatformSettings(),
    ]);

    const isBootstrapAdmin =
      firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL && firebaseUser.emailVerified;

    if (userSnap.exists() && walletSnap.exists()) {
      const existingProfile = userSnap.data() as UserProfile;
      const existingWallet = walletSnap.data() as CoinWallet;

      // Sync published websites to Express edge router in background
      syncUserPublishedWebsitesToEdge(uid).catch(() => {});

      return { profile: existingProfile, wallet: existingWallet };
    }

    // Generate clean unique username
    const rawBase =
      preferredUsername ||
      firebaseUser.email?.split('@')[0] ||
      firebaseUser.displayName ||
      `user_${uid.slice(0, 6)}`;
    let cleanUsername = rawBase
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 24);
    if (cleanUsername.length < 3) {
      cleanUsername = `user_${uid.slice(0, 6).toLowerCase()}`;
    }

    const bonusCoins = settings.registrationBonusCoins ?? 100;
    const txId = generateId('tx_reg');
    const txRef = doc(db, 'coin_transactions', txId);

    const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
      uid,
      username: cleanUsername,
      email: (firebaseUser.email || 'user@prachurjohost.com').slice(0, 254),
      displayName: (firebaseUser.displayName || cleanUsername).slice(0, 80),
      photoURL: (firebaseUser.photoURL || '').slice(0, 500),
      role: isBootstrapAdmin ? 'ADMIN' : 'USER',
      status: 'ACTIVE',
      storageQuotaBytes: settings.defaultStorageQuotaBytes || 52428800,
      storageUsedBytes: 0,
      twoFactorEnabled: false,
      emailVerified: Boolean(firebaseUser.emailVerified),
    };

    const newWallet: Omit<CoinWallet, 'updatedAt'> = {
      userId: uid,
      balance: bonusCoins,
      totalEarned: bonusCoins,
      totalSpent: 0,
      lastDailyRewardAt: '',
    };

    await runTransaction(db, async (transaction) => {
      const uCheck = await transaction.get(userRef);
      if (!uCheck.exists()) {
        transaction.set(userRef, {
          ...newProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      const wCheck = await transaction.get(walletRef);
      if (!wCheck.exists()) {
        transaction.set(walletRef, {
          ...newWallet,
          updatedAt: serverTimestamp(),
        });
        transaction.set(txRef, {
          id: txId,
          userId: uid,
          amount: bonusCoins,
          balanceAfter: bonusCoins,
          transactionType: 'REGISTRATION_BONUS',
          referenceId: uid,
          idempotencyKey: `reg_bonus_${uid}`,
          description: `Welcome registration bonus (+${bonusCoins} coins)`,
          createdAt: serverTimestamp(),
        });
      }
    });

    // If bootstrap admin and global settings not yet persisted, initialize global settings
    if (isBootstrapAdmin) {
      const settingsRef = doc(db, 'platform_settings', 'global');
      const settingsSnap = await getDoc(settingsRef);
      if (!settingsSnap.exists()) {
        await setDoc(settingsRef, {
          ...DEFAULT_PLATFORM_SETTINGS,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await createNotificationRecord(
      uid,
      'Welcome to Prachurjo Host',
      `Your account is active and credited with ${bonusCoins} registration bonus coins.`,
      'WALLET'
    );

    const [finalUser, finalWallet] = await Promise.all([getDoc(userRef), getDoc(walletRef)]);
    return {
      profile: finalUser.data() as UserProfile,
      wallet: finalWallet.data() as CoinWallet,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

export async function syncPublishedWebsiteToEdge(website: Website, files: StorageObject[], customHostnames: string[] = []) {
  try {
    const fileMap: Record<string, { fileName: string; mimeType: string; content: string; sizeBytes: number }> = {};
    for (const f of files) {
      fileMap[f.fileName] = {
        fileName: f.fileName,
        mimeType: f.mimeType,
        content: f.content,
        sizeBytes: f.sizeBytes,
      };
    }
    await fetch('/api/sites/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        websiteId: website.id,
        name: website.name,
        slug: website.slug,
        primaryHostname: website.primaryHostname,
        customHostnames,
        entryFile: website.entryFile || 'index.html',
        status: website.status,
        ownerUsername: website.ownerUsername,
        versionNumber: website.currentVersionNumber || 1,
        publishedAt: new Date().toISOString(),
        files: fileMap,
      }),
    });
  } catch (err) {
    console.warn('Edge router sync warning:', err);
  }
}

export async function syncUserPublishedWebsitesToEdge(userId: string) {
  try {
    const q = query(collection(db, 'websites'), where('userId', '==', userId));
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const site = docSnap.data() as Website;
      if (site.status === 'PUBLISHED' && site.publishedVersionId) {
        const filesQ = query(
          collection(db, 'storage_objects'),
          where('websiteId', '==', site.id),
          where('isPublic', '==', true)
        );
        const filesSnap = await getDocs(filesQ);
        const publishedFiles = filesSnap.docs
          .map((d) => d.data() as StorageObject)
          .filter((f) => f.versionId === site.publishedVersionId);
        if (publishedFiles.length > 0) {
          await syncPublishedWebsiteToEdge(site, publishedFiles);
        }
      }
    }
  } catch {
    // Ignore background sync errors
  }
}

export async function createWebsiteProject(
  profile: UserProfile,
  params: {
    name: string;
    slug: string;
    description: string;
    visibility: WebsiteVisibility;
    entryFile: string;
    files: TemplateFileSeed[];
  }
): Promise<Website> {
  const cleanName = params.name.trim().slice(0, 80);
  if (!cleanName) {
    throw new Error('Website name is required.');
  }

  const normalizedSlug = normalizeSlug(params.slug || cleanName);
  const slugValidation = validateWebsiteSlug(normalizedSlug);
  if (!slugValidation.valid) {
    throw new Error(slugValidation.error);
  }

  // Check slug availability on edge + Firestore published sites
  const avail = await checkHostnameAvailability(normalizedSlug);
  if (!avail.available) {
    throw new Error(avail.reason || 'That website address is already taken.');
  }

  // Calculate total bytes
  let totalBytes = 0;
  for (const file of params.files) {
    const check = validateSafeFilePath(file.fileName);
    if (!check.valid) {
      throw new Error(check.error);
    }
    const size = new Blob([file.content]).size;
    totalBytes += size;
  }

  if (profile.storageUsedBytes + totalBytes > profile.storageQuotaBytes) {
    throw new Error('Storage quota exceeded. Upgrade your storage or remove unused files.');
  }

  const websiteId = generateId('site');
  const primaryHostname = `${normalizedSlug}.prachurjohost.com`;
  const websiteRef = doc(db, 'websites', websiteId);
  const userRef = doc(db, 'users', profile.uid);

  const newWebsite: Omit<Website, 'createdAt' | 'updatedAt'> = {
    id: websiteId,
    userId: profile.uid,
    ownerUsername: profile.username,
    name: cleanName,
    slug: normalizedSlug,
    description: (params.description || 'Hosted on Prachurjo Host').trim().slice(0, 500),
    visibility: params.visibility || 'PUBLIC',
    entryFile: params.entryFile || 'index.html',
    status: 'DRAFT',
    primaryHostname,
    storageBytes: totalBytes,
    publishedVersionId: '',
    currentVersionNumber: 0,
  };

  try {
    await setDoc(websiteRef, {
      ...newWebsite,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Store initial draft files
    const batch = writeBatch(db);
    for (const f of params.files) {
      const objId = generateId('obj');
      const objRef = doc(db, 'storage_objects', objId);
      const sizeBytes = new Blob([f.content]).size;
      batch.set(objRef, {
        id: objId,
        userId: profile.uid,
        websiteId,
        versionId: 'draft',
        objectKey: `tenants/${profile.uid}/${websiteId}/draft/${f.fileName}`,
        fileName: f.fileName,
        mimeType: f.mimeType || 'text/plain; charset=utf-8',
        sizeBytes,
        content: f.content.slice(0, 490000),
        isPublic: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Create default subdomain record
    const domainId = generateId('dom');
    const domainRef = doc(db, 'domains', domainId);
    batch.set(domainRef, {
      id: domainId,
      websiteId,
      userId: profile.uid,
      hostname: primaryHostname,
      domainType: 'SUBDOMAIN',
      verificationStatus: 'VERIFIED',
      verificationToken: `ph_verify_${websiteId}`,
      isPrimary: true,
      createdAt: serverTimestamp(),
    });

    // Update user storageUsedBytes
    batch.update(userRef, {
      storageUsedBytes: Math.max(0, profile.storageUsedBytes + totalBytes),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    const snap = await getDoc(websiteRef);
    return snap.data() as Website;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `websites/${websiteId}`);
  }
}

export async function getDraftFilesForWebsite(userId: string, websiteId: string): Promise<StorageObject[]> {
  try {
    const q = query(
      collection(db, 'storage_objects'),
      where('userId', '==', userId),
      where('websiteId', '==', websiteId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as StorageObject)
      .filter((f) => f.versionId === 'draft')
      .sort((a, b) => {
        if (a.fileName === 'index.html') return -1;
        if (b.fileName === 'index.html') return 1;
        return a.fileName.localeCompare(b.fileName);
      });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'storage_objects');
  }
}

export async function saveDraftFileContent(
  profile: UserProfile,
  website: Website,
  fileObj: StorageObject,
  newContent: string
): Promise<StorageObject> {
  const newSizeBytes = new Blob([newContent]).size;
  if (newSizeBytes > 480000) {
    throw new Error('File exceeds the 480 KB per-file size limit.');
  }
  const deltaBytes = newSizeBytes - fileObj.sizeBytes;
  if (profile.storageUsedBytes + deltaBytes > profile.storageQuotaBytes) {
    throw new Error('Insufficient storage quota to save changes.');
  }

  const fileRef = doc(db, 'storage_objects', fileObj.id);
  const siteRef = doc(db, 'websites', website.id);
  const userRef = doc(db, 'users', profile.uid);

  try {
    const batch = writeBatch(db);
    batch.update(fileRef, {
      content: newContent,
      sizeBytes: newSizeBytes,
      updatedAt: serverTimestamp(),
    });
    batch.update(siteRef, {
      storageBytes: Math.max(0, website.storageBytes + deltaBytes),
      updatedAt: serverTimestamp(),
    });
    batch.update(userRef, {
      storageUsedBytes: Math.max(0, profile.storageUsedBytes + deltaBytes),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return {
      ...fileObj,
      content: newContent,
      sizeBytes: newSizeBytes,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `storage_objects/${fileObj.id}`);
  }
}

export async function createOrReplaceDraftFile(
  profile: UserProfile,
  website: Website,
  existingDraftFiles: StorageObject[],
  fileName: string,
  content: string
): Promise<StorageObject> {
  const pathCheck = validateSafeFilePath(fileName);
  if (!pathCheck.valid) {
    throw new Error(pathCheck.error || 'Invalid file name.');
  }
  const cleanName = pathCheck.normalizedPath;
  const ext = getExtension(cleanName);
  const mimeType = ALLOWED_EXTENSIONS[ext] || 'text/plain; charset=utf-8';
  const sizeBytes = new Blob([content]).size;

  const existing = existingDraftFiles.find((f) => f.fileName.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    return saveDraftFileContent(profile, website, existing, content);
  }

  if (existingDraftFiles.length >= 40) {
    throw new Error('Maximum of 40 files per website reached.');
  }
  if (profile.storageUsedBytes + sizeBytes > profile.storageQuotaBytes) {
    throw new Error('Storage quota limit reached.');
  }

  const objId = generateId('obj');
  const objRef = doc(db, 'storage_objects', objId);
  const siteRef = doc(db, 'websites', website.id);
  const userRef = doc(db, 'users', profile.uid);

  try {
    const batch = writeBatch(db);
    batch.set(objRef, {
      id: objId,
      userId: profile.uid,
      websiteId: website.id,
      versionId: 'draft',
      objectKey: `tenants/${profile.uid}/${website.id}/draft/${cleanName}`,
      fileName: cleanName,
      mimeType,
      sizeBytes,
      content: content.slice(0, 490000),
      isPublic: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(siteRef, {
      storageBytes: Math.max(0, website.storageBytes + sizeBytes),
      updatedAt: serverTimestamp(),
    });
    batch.update(userRef, {
      storageUsedBytes: Math.max(0, profile.storageUsedBytes + sizeBytes),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    const snap = await getDoc(objRef);
    return snap.data() as StorageObject;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `storage_objects/${objId}`);
  }
}

export async function renameDraftFile(
  fileObj: StorageObject,
  newFileName: string,
  existingDraftFiles: StorageObject[]
): Promise<StorageObject> {
  const pathCheck = validateSafeFilePath(newFileName);
  if (!pathCheck.valid) {
    throw new Error(pathCheck.error || 'Invalid file name.');
  }
  const cleanName = pathCheck.normalizedPath;
  if (
    existingDraftFiles.some(
      (f) => f.id !== fileObj.id && f.fileName.toLowerCase() === cleanName.toLowerCase()
    )
  ) {
    throw new Error(`A file named "${cleanName}" already exists in this project.`);
  }
  const ext = getExtension(cleanName);
  const mimeType = ALLOWED_EXTENSIONS[ext] || 'text/plain; charset=utf-8';
  const ref = doc(db, 'storage_objects', fileObj.id);
  try {
    await updateDoc(ref, {
      fileName: cleanName,
      mimeType,
      updatedAt: serverTimestamp(),
    });
    return { ...fileObj, fileName: cleanName, mimeType };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `storage_objects/${fileObj.id}`);
  }
}

export async function deleteDraftFile(
  profile: UserProfile,
  website: Website,
  fileObj: StorageObject
): Promise<void> {
  if (fileObj.fileName === website.entryFile) {
    throw new Error(`Cannot delete the primary entry file (${website.entryFile}).`);
  }
  const fileRef = doc(db, 'storage_objects', fileObj.id);
  const siteRef = doc(db, 'websites', website.id);
  const userRef = doc(db, 'users', profile.uid);

  try {
    const batch = writeBatch(db);
    batch.delete(fileRef);
    batch.update(siteRef, {
      storageBytes: Math.max(0, website.storageBytes - fileObj.sizeBytes),
      updatedAt: serverTimestamp(),
    });
    batch.update(userRef, {
      storageUsedBytes: Math.max(0, profile.storageUsedBytes - fileObj.sizeBytes),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `storage_objects/${fileObj.id}`);
  }
}

export async function checkHostnameAvailability(
  desiredSlug: string,
  currentWebsiteId?: string
): Promise<{ available: boolean; normalizedSlug: string; hostname: string; publicPath: string; reason?: string }> {
  const cleanSlug = normalizeSlug(desiredSlug);
  const validation = validateWebsiteSlug(cleanSlug);
  if (!validation.valid) {
    return {
      available: false,
      normalizedSlug: cleanSlug,
      hostname: `${cleanSlug}.prachurjohost.com`,
      publicPath: `/sites/${cleanSlug}`,
      reason: validation.error,
    };
  }

  try {
    const res = await fetch('/api/domains/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: cleanSlug, websiteId: currentWebsiteId || '' }),
    });
    const data = await res.json();
    if (!data.available) {
      return {
        available: false,
        normalizedSlug: cleanSlug,
        hostname: `${cleanSlug}.prachurjohost.com`,
        publicPath: `/sites/${cleanSlug}`,
        reason: data.reason,
      };
    }

    // Also verify against published websites in Firestore
    const pubQuery = query(collection(db, 'websites'), where('status', '==', 'PUBLISHED'));
    const pubSnap = await getDocs(pubQuery);
    const conflict = pubSnap.docs.find((d) => {
      const w = d.data() as Website;
      return w.slug.toLowerCase() === cleanSlug && w.id !== currentWebsiteId;
    });

    if (conflict) {
      return {
        available: false,
        normalizedSlug: cleanSlug,
        hostname: `${cleanSlug}.prachurjohost.com`,
        publicPath: `/sites/${cleanSlug}`,
        reason: `${cleanSlug}.prachurjohost.com is already assigned to another published website.`,
      };
    }

    return {
      available: true,
      normalizedSlug: cleanSlug,
      hostname: `${cleanSlug}.prachurjohost.com`,
      publicPath: `/sites/${cleanSlug}`,
    };
  } catch {
    return {
      available: true,
      normalizedSlug: cleanSlug,
      hostname: `${cleanSlug}.prachurjohost.com`,
      publicPath: `/sites/${cleanSlug}`,
    };
  }
}

export async function publishWebsiteAtomically(params: {
  profile: UserProfile;
  website: Website;
  draftFiles: StorageObject[];
  desiredName: string;
  desiredDescription: string;
  desiredSlug: string;
  desiredVisibility: WebsiteVisibility;
  selectedEntryFile: string;
  idempotencyKey: string;
}): Promise<{ updatedWebsite: Website; versionNumber: number; publicUrl: string; coinsCharged: number }> {
  const {
    profile,
    website,
    draftFiles,
    desiredName,
    desiredDescription,
    desiredSlug,
    desiredVisibility,
    selectedEntryFile,
    idempotencyKey,
  } = params;

  if (profile.status === 'SUSPENDED') {
    throw new Error('Your account is suspended and cannot publish websites.');
  }
  if (website.status === 'SUSPENDED') {
    throw new Error('This website has been suspended by an administrator.');
  }

  const settings = await getOrInitPlatformSettings();
  if (!settings.publishingEnabled) {
    throw new Error('Website publishing is temporarily disabled by platform administration.');
  }

  if (draftFiles.length === 0) {
    throw new Error('Cannot publish an empty website. Add at least an index.html file first.');
  }

  const entryExists = draftFiles.some((f) => f.fileName === selectedEntryFile);
  if (!entryExists) {
    throw new Error(`Selected entry file "${selectedEntryFile}" does not exist in your project files.`);
  }

  const availability = await checkHostnameAvailability(desiredSlug, website.id);
  if (!availability.available) {
    throw new Error(availability.reason || 'Requested website address is unavailable.');
  }

  const cleanSlug = availability.normalizedSlug;
  const primaryHostname = availability.hostname;
  const nextVersionNumber = (website.currentVersionNumber || 0) + 1;
  const versionId = generateId(`v${nextVersionNumber}`);

  // Calculate coin cost: publishPriceCoins + optional rename/domain change if already published
  let totalCoinCost = settings.coinSystemEnabled ? settings.publishPriceCoins : 0;
  const isSlugChanged = website.status === 'PUBLISHED' && website.slug !== cleanSlug;
  const isNameChanged = website.status === 'PUBLISHED' && website.name !== desiredName.trim();
  if (settings.coinSystemEnabled) {
    if (isSlugChanged) totalCoinCost += settings.domainChangePriceCoins;
    if (isNameChanged) totalCoinCost += settings.renamePriceCoins;
  }

  const walletRef = doc(db, 'coin_wallets', profile.uid);
  const websiteRef = doc(db, 'websites', website.id);
  const versionRef = doc(db, 'website_versions', versionId);
  const txId = generateId('tx_pub');
  const txRef = doc(db, 'coin_transactions', txId);

  try {
    // Step 1: Atomic transaction to deduct coins, create ledger record, create version record, and mark PUBLISHED
    await runTransaction(db, async (transaction) => {
      const walletSnap = await transaction.get(walletRef);
      if (!walletSnap.exists()) {
        throw new Error('Wallet record not found.');
      }
      const wallet = walletSnap.data() as CoinWallet;

      if (totalCoinCost > 0 && wallet.balance < totalCoinCost) {
        throw new Error(
          `Insufficient coins. Required: ${totalCoinCost} coins, Available: ${wallet.balance} coins.`
        );
      }

      const newBalance = wallet.balance - totalCoinCost;
      if (totalCoinCost > 0) {
        transaction.update(walletRef, {
          balance: newBalance,
          totalSpent: wallet.totalSpent + totalCoinCost,
          updatedAt: serverTimestamp(),
        });

        transaction.set(txRef, {
          id: txId,
          userId: profile.uid,
          amount: -totalCoinCost,
          balanceAfter: newBalance,
          transactionType: 'WEBSITE_PUBLISH',
          referenceId: website.id,
          idempotencyKey,
          description: `Published ${desiredName.trim()} (${primaryHostname}) · v${nextVersionNumber}`,
          createdAt: serverTimestamp(),
        });
      }

      transaction.set(versionRef, {
        id: versionId,
        websiteId: website.id,
        userId: profile.uid,
        versionNumber: nextVersionNumber,
        storagePrefix: `tenants/${profile.uid}/${website.id}/versions/${versionId}`,
        deploymentStatus: 'PUBLISHED',
        fileCount: draftFiles.length,
        totalBytes: website.storageBytes,
        createdAt: serverTimestamp(),
      });

      transaction.update(websiteRef, {
        name: desiredName.trim().slice(0, 80),
        description: desiredDescription.trim().slice(0, 500),
        slug: cleanSlug,
        visibility: desiredVisibility,
        entryFile: selectedEntryFile,
        status: 'PUBLISHED',
        primaryHostname,
        publishedVersionId: versionId,
        currentVersionNumber: nextVersionNumber,
        updatedAt: serverTimestamp(),
      });
    });

    // Step 2: Write immutable public StorageObjects for the published version snapshot
    const batch = writeBatch(db);
    const publishedStorageObjects: StorageObject[] = [];
    for (const df of draftFiles) {
      const pubObjId = generateId('pubobj');
      const pubObjRef = doc(db, 'storage_objects', pubObjId);
      const record: StorageObject = {
        id: pubObjId,
        userId: profile.uid,
        websiteId: website.id,
        versionId,
        objectKey: `tenants/${profile.uid}/${website.id}/versions/${versionId}/${df.fileName}`,
        fileName: df.fileName,
        mimeType: df.mimeType,
        sizeBytes: df.sizeBytes,
        content: df.content,
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      publishedStorageObjects.push(record);
      batch.set(pubObjRef, {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();

    const updatedWebsite: Website = {
      ...website,
      name: desiredName.trim().slice(0, 80),
      description: desiredDescription.trim().slice(0, 500),
      slug: cleanSlug,
      visibility: desiredVisibility,
      entryFile: selectedEntryFile,
      status: 'PUBLISHED',
      primaryHostname,
      publishedVersionId: versionId,
      currentVersionNumber: nextVersionNumber,
    };

    // Step 3: Sync to Express Multi-Tenant Edge Router so /sites/:slug is immediately live
    await syncPublishedWebsiteToEdge(updatedWebsite, publishedStorageObjects);

    await createNotificationRecord(
      profile.uid,
      'Website Published Live',
      `${updatedWebsite.name} (v${nextVersionNumber}) is now live at ${primaryHostname} (/sites/${cleanSlug}).`,
      'PUBLISH'
    );

    return {
      updatedWebsite,
      versionNumber: nextVersionNumber,
      publicUrl: `/sites/${cleanSlug}`,
      coinsCharged: totalCoinCost,
    };
  } catch (err) {
    // If step 2 failed after coins were deducted, issue an automatic single idempotent refund
    if (err instanceof Error && !err.message.includes('Insufficient coins')) {
      await refundFailedPublishIfCharged(profile.uid, website.id, idempotencyKey, totalCoinCost);
    }
    throw err;
  }
}

async function refundFailedPublishIfCharged(
  userId: string,
  websiteId: string,
  originalIdempotencyKey: string,
  amountToRefund: number
) {
  if (amountToRefund <= 0) return;
  const refundKey = `refund_${originalIdempotencyKey}`;
  const walletRef = doc(db, 'coin_wallets', userId);
  const refundTxId = generateId('tx_ref');
  const refundTxRef = doc(db, 'coin_transactions', refundTxId);

  try {
    const q = query(
      collection(db, 'coin_transactions'),
      where('userId', '==', userId),
      where('idempotencyKey', '==', originalIdempotencyKey)
    );
    const snap = await getDocs(q);
    if (snap.empty) return; // Never charged

    const refQ = query(
      collection(db, 'coin_transactions'),
      where('userId', '==', userId),
      where('idempotencyKey', '==', refundKey)
    );
    const refSnap = await getDocs(refQ);
    if (!refSnap.empty) return; // Already refunded once

    await runTransaction(db, async (transaction) => {
      const wSnap = await transaction.get(walletRef);
      if (!wSnap.exists()) return;
      const w = wSnap.data() as CoinWallet;
      const nextBal = w.balance + amountToRefund;
      transaction.update(walletRef, {
        balance: nextBal,
        totalSpent: Math.max(0, w.totalSpent - amountToRefund),
        updatedAt: serverTimestamp(),
      });
      transaction.set(refundTxRef, {
        id: refundTxId,
        userId,
        amount: amountToRefund,
        balanceAfter: nextBal,
        transactionType: 'REFUND',
        referenceId: websiteId,
        idempotencyKey: refundKey,
        description: `Automatic refund for failed deployment (${amountToRefund} coins)`,
        createdAt: serverTimestamp(),
      });
    });

    await createNotificationRecord(
      userId,
      'Publishing Charge Refunded',
      `${amountToRefund} coins were automatically refunded due to a deployment interruption.`,
      'WALLET'
    );
  } catch (e) {
    console.error('Refund recovery check failed:', e);
  }
}

export async function unpublishWebsite(website: Website): Promise<Website> {
  const ref = doc(db, 'websites', website.id);
  try {
    await updateDoc(ref, {
      status: 'DRAFT',
      updatedAt: serverTimestamp(),
    });
    await fetch(`/api/sites/${website.slug}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DRAFT' }),
    });
    return { ...website, status: 'DRAFT' };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `websites/${website.id}`);
  }
}

export async function deleteWebsiteProject(profile: UserProfile, website: Website): Promise<void> {
  try {
    const filesQ = query(
      collection(db, 'storage_objects'),
      where('userId', '==', profile.uid),
      where('websiteId', '==', website.id)
    );
    const filesSnap = await getDocs(filesQ);
    const batch = writeBatch(db);
    filesSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'websites', website.id));
    batch.update(doc(db, 'users', profile.uid), {
      storageUsedBytes: Math.max(0, profile.storageUsedBytes - website.storageBytes),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    await fetch(`/api/sites/${website.slug}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ARCHIVED' }),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `websites/${website.id}`);
  }
}

export async function addCustomDomainToWebsite(
  profile: UserProfile,
  website: Website,
  customHostname: string
): Promise<DomainRecord> {
  const check = validateCustomDomainHostname(customHostname);
  if (!check.valid) {
    throw new Error(check.error);
  }
  const cleanHost = customHostname.toLowerCase().trim();
  const domainId = generateId('dom');
  const verificationToken = `prachurjohost-verify=${website.id.slice(0, 12)}-${Date.now().toString(36)}`;
  const ref = doc(db, 'domains', domainId);

  try {
    await setDoc(ref, {
      id: domainId,
      websiteId: website.id,
      userId: profile.uid,
      hostname: cleanHost,
      domainType: 'CUSTOM',
      verificationStatus: 'PENDING',
      verificationToken,
      isPrimary: false,
      createdAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return snap.data() as DomainRecord;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `domains/${domainId}`);
  }
}

export async function verifyCustomDomainRecord(domain: DomainRecord): Promise<DomainRecord> {
  const ref = doc(db, 'domains', domain.id);
  try {
    await updateDoc(ref, {
      verificationStatus: 'VERIFIED',
    });
    await createNotificationRecord(
      domain.userId,
      'Custom Domain Verified',
      `DNS ownership verified for ${domain.hostname}. Routing is now active.`,
      'DOMAIN'
    );
    return { ...domain, verificationStatus: 'VERIFIED' };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `domains/${domain.id}`);
  }
}

export async function claimDailyCoinReward(userId: string): Promise<{ rewardAmount: number; newBalance: number }> {
  const settings = await getOrInitPlatformSettings();
  const rewardAmount = settings.dailyRewardCoins ?? 5;
  if (rewardAmount <= 0) {
    throw new Error('Daily rewards are currently disabled.');
  }

  const walletRef = doc(db, 'coin_wallets', userId);
  const txId = generateId('tx_daily');
  const txRef = doc(db, 'coin_transactions', txId);
  const todayKey = new Date().toISOString().slice(0, 10);

  let updatedBalance = 0;
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(walletRef);
    if (!snap.exists()) {
      throw new Error('Coin wallet not found.');
    }
    const wallet = snap.data() as CoinWallet;
    if (wallet.lastDailyRewardAt && wallet.lastDailyRewardAt.startsWith(todayKey)) {
      throw new Error('You have already claimed your daily coin reward today. Come back tomorrow!');
    }

    updatedBalance = wallet.balance + rewardAmount;
    const nowIso = new Date().toISOString();

    transaction.update(walletRef, {
      balance: updatedBalance,
      totalEarned: wallet.totalEarned + rewardAmount,
      lastDailyRewardAt: nowIso,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txRef, {
      id: txId,
      userId,
      amount: rewardAmount,
      balanceAfter: updatedBalance,
      transactionType: 'DAILY_REWARD',
      referenceId: todayKey,
      idempotencyKey: `daily_${userId}_${todayKey}`,
      description: `Daily login reward claimed (+${rewardAmount} coins)`,
      createdAt: serverTimestamp(),
    });
  });

  await createNotificationRecord(
    userId,
    'Daily Reward Claimed',
    `+${rewardAmount} coins have been added to your wallet.`,
    'WALLET'
  );

  return { rewardAmount, newBalance: updatedBalance };
}

export async function redeemPromotionalCode(
  userId: string,
  rawCodeInput: string
): Promise<{ coinAmount: number; newBalance: number; code: string }> {
  const cleanCode = rawCodeInput.trim().toUpperCase();
  if (cleanCode.length < 4) {
    throw new Error('Enter a valid promotional code.');
  }

  const q = query(collection(db, 'redeem_codes'), where('isActive', '==', true));
  const snap = await getDocs(q);
  const matchedDoc = snap.docs.find((d) => {
    const rc = d.data() as RedeemCode;
    return rc.code.toUpperCase() === cleanCode;
  });

  if (!matchedDoc) {
    throw new Error('Invalid or disabled redeem code.');
  }

  const codeRecord = matchedDoc.data() as RedeemCode;
  if (codeRecord.expiresAt && new Date(codeRecord.expiresAt).getTime() < Date.now()) {
    throw new Error('This promotional code has expired.');
  }
  if (codeRecord.currentRedemptions >= codeRecord.maxRedemptions) {
    throw new Error('This promotional code has reached its maximum redemption limit.');
  }

  // Check per-user redemption history
  const redemptionsQ = query(
    collection(db, 'redeem_redemptions'),
    where('userId', '==', userId)
  );
  const redemptionsSnap = await getDocs(redemptionsQ);
  const userUses = redemptionsSnap.docs.filter(
    (d) => d.data().redeemCodeId === codeRecord.id
  ).length;

  if (userUses >= (codeRecord.perUserLimit || 1)) {
    throw new Error('You have already redeemed this promotional code the maximum number of times.');
  }

  const codeRef = doc(db, 'redeem_codes', codeRecord.id);
  const walletRef = doc(db, 'coin_wallets', userId);
  const txId = generateId('tx_redeem');
  const txRef = doc(db, 'coin_transactions', txId);
  const redemptionId = generateId('redemp');
  const redemptionRef = doc(db, 'redeem_redemptions', redemptionId);

  let updatedBalance = 0;
  await runTransaction(db, async (transaction) => {
    const [freshCodeSnap, freshWalletSnap] = await Promise.all([
      transaction.get(codeRef),
      transaction.get(walletRef),
    ]);

    if (!freshCodeSnap.exists()) {
      throw new Error('Redeem code no longer exists.');
    }
    const freshCode = freshCodeSnap.data() as RedeemCode;
    if (!freshCode.isActive || freshCode.currentRedemptions >= freshCode.maxRedemptions) {
      throw new Error('Redeem code is no longer available.');
    }
    if (!freshWalletSnap.exists()) {
      throw new Error('Wallet not found.');
    }
    const wallet = freshWalletSnap.data() as CoinWallet;
    updatedBalance = wallet.balance + freshCode.coinAmount;

    transaction.update(codeRef, {
      currentRedemptions: freshCode.currentRedemptions + 1,
    });

    transaction.update(walletRef, {
      balance: updatedBalance,
      totalEarned: wallet.totalEarned + freshCode.coinAmount,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txRef, {
      id: txId,
      userId,
      amount: freshCode.coinAmount,
      balanceAfter: updatedBalance,
      transactionType: 'REDEEM_REWARD',
      referenceId: freshCode.id,
      idempotencyKey: `redeem_${userId}_${freshCode.id}_${userUses + 1}`,
      description: `Redeemed promo code ${freshCode.code} (+${freshCode.coinAmount} coins)`,
      createdAt: serverTimestamp(),
    });

    transaction.set(redemptionRef, {
      id: redemptionId,
      redeemCodeId: freshCode.id,
      code: freshCode.code,
      userId,
      coinAmount: freshCode.coinAmount,
      coinTransactionId: txId,
      createdAt: serverTimestamp(),
    });
  });

  await createNotificationRecord(
    userId,
    'Promo Code Redeemed',
    `Code "${cleanCode}" credited +${codeRecord.coinAmount} coins to your wallet.`,
    'WALLET'
  );

  return {
    coinAmount: codeRecord.coinAmount,
    newBalance: updatedBalance,
    code: cleanCode,
  };
}

export async function upgradeUserStorageWithCoins(
  profile: UserProfile
): Promise<{ addedBytes: number; cost: number; newQuotaBytes: number }> {
  const settings = await getOrInitPlatformSettings();
  const cost = settings.storageUpgradePriceCoins ?? 40;
  const addedBytes = 50 * 1024 * 1024; // +50 MB
  const walletRef = doc(db, 'coin_wallets', profile.uid);
  const userRef = doc(db, 'users', profile.uid);
  const txId = generateId('tx_stg');
  const txRef = doc(db, 'coin_transactions', txId);

  const newQuotaBytes = profile.storageQuotaBytes + addedBytes;

  await runTransaction(db, async (transaction) => {
    const wSnap = await transaction.get(walletRef);
    if (!wSnap.exists()) throw new Error('Wallet not found.');
    const wallet = wSnap.data() as CoinWallet;
    if (wallet.balance < cost) {
      throw new Error(`Insufficient coins. Upgrade requires ${cost} coins.`);
    }
    const nextBal = wallet.balance - cost;
    transaction.update(walletRef, {
      balance: nextBal,
      totalSpent: wallet.totalSpent + cost,
      updatedAt: serverTimestamp(),
    });
    transaction.update(userRef, {
      storageQuotaBytes: newQuotaBytes,
      updatedAt: serverTimestamp(),
    });
    transaction.set(txRef, {
      id: txId,
      userId: profile.uid,
      amount: -cost,
      balanceAfter: nextBal,
      transactionType: 'STORAGE_UPGRADE',
      referenceId: profile.uid,
      idempotencyKey: `stg_${profile.uid}_${Date.now()}`,
      description: `Storage quota upgraded by +50 MB (-${cost} coins)`,
      createdAt: serverTimestamp(),
    });
  });

  await createNotificationRecord(
    profile.uid,
    'Storage Quota Upgraded',
    `Your storage limit was increased by 50 MB.`,
    'SYSTEM'
  );

  return { addedBytes, cost, newQuotaBytes };
}

// ============================================================================
// ADMINISTRATOR GOVERNANCE ACTIONS (WITH MANDATORY AUDIT LOGGING)
// ============================================================================

export async function recordAdminAuditLog(
  adminProfile: UserProfile,
  action: string,
  targetType: string,
  targetId: string,
  reason: string,
  metadataSummary: string
) {
  const id = generateId('audit');
  const ref = doc(db, 'admin_audit_logs', id);
  await setDoc(ref, {
    id,
    adminUserId: adminProfile.uid,
    adminEmail: adminProfile.email,
    action: action.slice(0, 80),
    targetType: targetType.slice(0, 40),
    targetId: targetId.slice(0, 128),
    reason: reason.trim().slice(0, 400),
    metadataSummary: metadataSummary.slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

export async function adminAdjustUserCoins(params: {
  adminProfile: UserProfile;
  targetUserId: string;
  targetUsername: string;
  amount: number; // positive for credit, negative for debit
  reason: string;
}): Promise<number> {
  const { adminProfile, targetUserId, targetUsername, amount, reason } = params;
  if (!reason || reason.trim().length < 3) {
    throw new Error('A clear administrator reason (minimum 3 characters) is mandatory for wallet adjustments.');
  }
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error('Adjustment amount must be a non-zero integer.');
  }

  const walletRef = doc(db, 'coin_wallets', targetUserId);
  const txId = generateId('tx_adm');
  const txRef = doc(db, 'coin_transactions', txId);
  const txType: TransactionType = amount > 0 ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT';

  let nextBalance = 0;
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(walletRef);
    if (!snap.exists()) {
      throw new Error('Target user wallet not found.');
    }
    const wallet = snap.data() as CoinWallet;
    nextBalance = wallet.balance + amount;
    if (nextBalance < 0) {
      throw new Error(`Cannot debit ${Math.abs(amount)} coins; user only has ${wallet.balance} coins.`);
    }

    transaction.update(walletRef, {
      balance: nextBalance,
      totalEarned: amount > 0 ? wallet.totalEarned + amount : wallet.totalEarned,
      totalSpent: amount < 0 ? wallet.totalSpent + Math.abs(amount) : wallet.totalSpent,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txRef, {
      id: txId,
      userId: targetUserId,
      amount,
      balanceAfter: nextBalance,
      transactionType: txType,
      referenceId: adminProfile.uid,
      idempotencyKey: `adm_${adminProfile.uid}_${targetUserId}_${Date.now()}`,
      description: `Admin ${amount > 0 ? 'credit' : 'debit'}: ${reason.trim()}`,
      createdAt: serverTimestamp(),
    });
  });

  await recordAdminAuditLog(
    adminProfile,
    txType,
    'USER_WALLET',
    targetUserId,
    reason,
    `Adjusted @${targetUsername} wallet by ${amount > 0 ? '+' : ''}${amount} coins (new balance: ${nextBalance})`
  );

  await createNotificationRecord(
    targetUserId,
    amount > 0 ? 'Coins Credited by Administrator' : 'Coins Deducted by Administrator',
    `${amount > 0 ? '+' : ''}${amount} coins · Reason: ${reason.trim()}`,
    'WALLET'
  );

  return nextBalance;
}

export async function adminSetUserStatus(
  adminProfile: UserProfile,
  targetUser: UserProfile,
  newStatus: 'ACTIVE' | 'SUSPENDED',
  reason: string
) {
  if (!reason || reason.trim().length < 3) {
    throw new Error('An administrator reason is required to change account status.');
  }
  const ref = doc(db, 'users', targetUser.uid);
  await updateDoc(ref, {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });
  await recordAdminAuditLog(
    adminProfile,
    newStatus === 'SUSPENDED' ? 'SUSPEND_USER' : 'RESTORE_USER',
    'USER',
    targetUser.uid,
    reason,
    `Changed @${targetUser.username} (${targetUser.email}) status to ${newStatus}`
  );
}

export async function adminSetWebsiteStatus(
  adminProfile: UserProfile,
  website: Website,
  newStatus: 'PUBLISHED' | 'SUSPENDED' | 'ARCHIVED' | 'DRAFT',
  reason: string
) {
  if (!reason || reason.trim().length < 3) {
    throw new Error('An administrator reason is required for website governance actions.');
  }
  const ref = doc(db, 'websites', website.id);
  await updateDoc(ref, {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });
  await fetch(`/api/sites/${website.slug}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  });
  await recordAdminAuditLog(
    adminProfile,
    `WEBSITE_STATUS_${newStatus}`,
    'WEBSITE',
    website.id,
    reason,
    `Set website "${website.name}" (${website.primaryHostname}) to ${newStatus}`
  );
  await createNotificationRecord(
    website.userId,
    `Website Status Changed: ${newStatus}`,
    `Your website "${website.name}" status was updated to ${newStatus}. Reason: ${reason.trim()}`,
    'SECURITY'
  );
}

export async function adminSavePlatformSettings(
  adminProfile: UserProfile,
  newSettings: PlatformSettings,
  reason: string
) {
  if (!reason || reason.trim().length < 3) {
    throw new Error('Provide an audit reason for updating platform settings or coin pricing.');
  }
  const ref = doc(db, 'platform_settings', 'global');
  await setDoc(ref, {
    ...newSettings,
    updatedAt: serverTimestamp(),
  });
  await recordAdminAuditLog(
    adminProfile,
    'UPDATE_PLATFORM_SETTINGS',
    'SETTINGS',
    'global',
    reason,
    `Publish=${newSettings.publishPriceCoins}c, Bonus=${newSettings.registrationBonusCoins}c, Daily=${newSettings.dailyRewardCoins}c`
  );
}

export async function adminGenerateRedeemCodes(params: {
  adminProfile: UserProfile;
  customCode?: string;
  batchCount: number;
  coinAmount: number;
  maxRedemptions: number;
  perUserLimit: number;
  expiresAt: string;
  reason: string;
}): Promise<RedeemCode[]> {
  const {
    adminProfile,
    customCode,
    batchCount,
    coinAmount,
    maxRedemptions,
    perUserLimit,
    expiresAt,
    reason,
  } = params;

  if (!reason || reason.trim().length < 3) {
    throw new Error('An administrator audit reason is required to issue promotional codes.');
  }

  const createdCodes: RedeemCode[] = [];
  const count = customCode ? 1 : Math.min(Math.max(1, batchCount), 25);

  for (let i = 0; i < count; i++) {
    const rawCode =
      customCode && customCode.trim()
        ? customCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')
        : `PH-${coinAmount}C-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const id = generateId('code');
    const codeHash = simpleCodeHash(rawCode);
    const ref = doc(db, 'redeem_codes', id);
    const record: RedeemCode = {
      id,
      code: rawCode,
      codeHash,
      coinAmount: Math.max(1, Math.round(coinAmount)),
      maxRedemptions: Math.max(1, Math.round(maxRedemptions)),
      perUserLimit: Math.max(1, Math.round(perUserLimit)),
      currentRedemptions: 0,
      expiresAt: expiresAt || '2027-12-31T23:59:59.000Z',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await setDoc(ref, {
      ...record,
      createdAt: serverTimestamp(),
    });
    createdCodes.push(record);
  }

  await recordAdminAuditLog(
    adminProfile,
    'GENERATE_REDEEM_CODES',
    'REDEEM_CODE',
    createdCodes[0]?.id || 'batch',
    reason,
    `Generated ${createdCodes.length} promo code(s) worth ${coinAmount} coins each`
  );

  return createdCodes;
}
