# Security Specification & Test Protocol

## 1. Data Invariants
- Only authenticated users can access the application's cloud storage.
- A user can only read, create, update, and delete their own flashcard decks and test results.
- The manager/admin role is strictly restricted to `m4len1as@gmail.com` with `email_verified == true`.
- Regular users cannot elevate their role to `admin` or `manager` during registration or profile updates.
- The manager can view system-wide stats, all decks, user lists, and test performance diagnostics for monitoring and platform management.

## 2. Dirty Dozen Payload Validation Tests
1. **Unauthenticated Read**: Attempting to read `/users` or `/decks` without auth -> DENIED.
2. **Privilege Escalation**: Non-manager updating `role: 'manager'` on user profile -> DENIED.
3. **Email Spoofing Attack**: User with `email: 'm4len1as@gmail.com'` but `email_verified: false` accessing manager panel -> DENIED.
4. **Cross-User Deck Modification**: User B attempting to edit or delete User A's deck -> DENIED.
5. **Cross-User Test Result Tampering**: User B attempting to write test results for User A -> DENIED.
6. **Path Traversal / Poisoned ID**: ID containing slashes or invalid characters -> DENIED.
7. **Giant Payload / Denial-of-Wallet**: Deck with title > 500 characters or invalid structure -> DENIED.
8. **Admin Override Legitimacy**: Verified `m4len1as@gmail.com` reading system decks -> ALLOWED.
