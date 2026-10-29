# Prachurjo Host — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Identity & PII Isolation (`users`)**:
   - A user document `/users/{userId}` can only be read by its owner (`request.auth.uid == userId`) or a verified administrator (`isAdmin()`).
   - Non-admin users can never self-assign `role: 'ADMIN'` or `status: 'SUSPENDED'` on creation, nor mutate `role`, `status`, or `storageQuotaBytes` on update.
2. **Tenant Ownership & Isolation (`websites`, `domains`, `website_versions`, `storage_objects`)**:
   - A website, domain, website version, or draft storage object can only be created/modified by its authenticated owner (`userId == request.auth.uid`) or an administrator.
   - Draft `storage_objects` (`isPublic == false`) are strictly unreadable by other tenants (`resource.data.userId == request.auth.uid || isAdmin()`).
   - Published `websites` (`status == 'PUBLISHED'`) and published `storage_objects` (`isPublic == true`) can be read for public site rendering, while suspended/draft sites remain protected.
3. **Coin Economy Integrity (`coin_wallets`, `coin_transactions`)**:
   - Balances in `/coin_wallets/{userId}` must ALWAYS be integers $\ge 0$ (`balance >= 0`).
   - Every ledger entry in `/coin_transactions/{txId}` is immutable once created (updates and deletes are strictly forbidden).
4. **Redeem Code & Audit Log Integrity (`redeem_codes`, `redeem_redemptions`, `admin_audit_logs`, `platform_settings`)**:
   - Only verified administrators (`isAdmin()`) can create/modify `/redeem_codes`, `/admin_audit_logs`, or `/platform_settings`.
   - `/admin_audit_logs` are strictly append-only (no updates or deletes permitted even by admins).
5. **Temporal & Structural Integrity**:
   - All document IDs must match `^[a-zA-Z0-9_\-]+$` with length $\le 128$.
   - All `createdAt` and `updatedAt` timestamps must match `request.time`.
   - Every string field has an explicit `.size() <= MAX` bound.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Self-Promoted Admin on Signup)**: User creates `/users/user_1` with `role: "ADMIN"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Cross-Tenant Draft File Read)**: `user_2` attempts `get` or `list` on `/storage_objects/obj_1` where `userId == "user_1"` and `isPublic == false`. -> `PERMISSION_DENIED`
3. **Payload 3 (Negative Coin Balance Injection)**: User updates `/coin_wallets/user_1` with `balance: -500`. -> `PERMISSION_DENIED`
4. **Payload 4 (Shadow Field Injection on Website Update)**: User updates `/websites/site_1` adding `{ isFeatured: true }` outside `affectedKeys().hasOnly(...)`. -> `PERMISSION_DENIED`
5. **Payload 5 (Unverified Admin Email Spoof)**: Attacker with `email: "prachurjosorkarporosh@gmail.com"` but `email_verified: false` attempts to update `/platform_settings/global`. -> `PERMISSION_DENIED`
6. **Payload 6 (Ledger History Tampering)**: User or Admin attempts `update` or `delete` on `/coin_transactions/tx_1`. -> `PERMISSION_DENIED`
7. **Payload 7 (Audit Log Deletion)**: Admin attempts `delete` on `/admin_audit_logs/log_1`. -> `PERMISSION_DENIED`
8. **Payload 8 (ID Poisoning / Oversized Path ID)**: User creates `/websites/{200_char_invalid_id$%}` with special characters. -> `PERMISSION_DENIED`
9. **Payload 9 (Timestamp Forgery)**: User creates `/websites/site_1` with backdated `createdAt: Timestamp(2020, 1, 1)` instead of `request.time`. -> `PERMISSION_DENIED`
10. **Payload 10 (Cross-Tenant Website Hijack)**: `user_1` updates `/websites/site_1` changing `userId` to `"user_2"`. -> `PERMISSION_DENIED`
11. **Payload 11 (Unauthorized Redeem Code Creation)**: Regular user creates `/redeem_codes/FREE1000` with `coinAmount: 1000`. -> `PERMISSION_DENIED`
12. **Payload 12 (PII Blanket Scraping)**: Regular `user_1` queries `list` on `/users` without admin privileges. -> `PERMISSION_DENIED`
