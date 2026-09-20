# Expense Tracker MVP - Security & Error Handling

## 1. Objective

This application stores personal financial information.

Security and error handling must therefore be treated as core architecture, not something added before deployment when everyone suddenly discovers that production exists.

The application must:

- Protect user data
- Prevent cross-user access
- Validate all input
- Protect authentication/session data
- Handle failures safely
- Avoid exposing sensitive information
- Preserve financial data during errors
- Provide useful diagnostics without leaking private data

---

# 2. Security Principles

Follow these rules throughout the application:

```text
1. Never trust client input.
2. Never trust client-provided userId.
3. Never trust client-calculated financial values.
4. Verify ownership on the server.
5. Validate at every API boundary.
6. Keep secrets server-side.
7. Do not expose database internals to the client.
8. Fail safely.
9. Never silently lose financial data.
10. Log enough to diagnose problems, but never log unnecessary financial data.
````

---

# 3. Authentication

Authentication should be handled by a proven authentication solution.

Do not implement custom password/session handling unless there is a strong reason.

The application must support:

```text
Login
Logout
Session validation
Session expiration
Protected routes
```

Every protected API request must resolve the authenticated user server-side.

---

# 4. Never Trust userId

Never accept this as the source of identity:

```json
{
  "userId": "user_123"
}
```

Instead:

```text
Request
  ↓
Authenticated session
  ↓
Server extracts userId
  ↓
Use case
```

If a request contains a `userId`, ignore it or reject it.

---

# 5. Authorization

Authentication answers:

```text
"Who are you?"
```

Authorization answers:

```text
"Are you allowed to access this?"
```

Every resource lookup must verify ownership.

Example:

```text
GET /api/expenses/:id
        ↓
Find expense
        ↓
expense.userId === authenticatedUserId
```

If not:

```text
Access denied
```

---

# 6. Resource Ownership

Verify ownership for every referenced resource.

Example shared expense:

```text
accountId
categoryId
personId
```

The server must verify:

```text
account.userId === currentUser
category.userId === currentUser
person.userId === currentUser
```

Do not assume that possessing an ID grants access.

---

# 7. IDOR Protection

Prevent insecure direct object references.

Example attack:

```text
User A
        ↓
GET /api/expenses/<User-B-expense-id>
```

Expected:

```text
404 Not Found
```

or another deliberately chosen safe response.

Never return User B's expense.

Apply this to:

```text
Accounts
People
Categories
Transactions
Expense Splits
Settlements
Settlement Allocations
```

---

# 8. Input Validation

Every API request must be validated using schemas.

Recommended:

```text
Zod
```

Validate:

```text
Required fields
Types
Enums
IDs
Amounts
Dates
String lengths
Array sizes
Nested objects
```

Frontend validation is useful for UX.

Server validation is mandatory for security.

---

# 9. Amount Validation

Money values must:

```text
be positive where required
have valid decimal representation
not exceed reasonable application limits
not contain NaN
not contain Infinity
```

Reject:

```text
-100
0
NaN
Infinity
"abc"
```

unless a specific domain operation legitimately allows zero.

---

# 10. Decimal Handling

Do not perform authoritative financial calculations using JavaScript floating-point numbers.

Avoid:

```ts
0.1 + 0.2 === 0.3
```

for financial logic.

Use:

```text
MongoDB Decimal128
+
decimal-safe application calculations
```

where required.

---

# 11. String Validation

Limit user-provided strings.

Example:

```text
name
description
notes
category name
```

Define reasonable maximum lengths.

Reject excessively large payloads.

Example conceptual limits:

```text
Name: 100 chars
Description: 500 chars
Notes: 2,000 chars
```

Exact limits can be adjusted based on UX requirements.

---

# 12. Array Limits

Do not allow unlimited arrays from the client.

For example:

```text
participants
settlement allocations
```

should have reasonable limits.

This prevents:

```text
Huge request
    ↓
Excessive processing
    ↓
Resource exhaustion
```

---

# 13. MongoDB Injection

Never construct MongoDB queries directly from untrusted client objects.

Bad:

```ts
collection.find(req.body)
```

Instead:

```text
Request
 ↓
Validated DTO
 ↓
Explicit query construction
```

Only allow known fields.

---

# 14. Query Parameters

Validate query parameters too.

Example:

```text
limit
cursor
from
to
categoryId
accountId
personId
```

Do not blindly pass query parameters into MongoDB.

---

# 15. Pagination Limits

Never allow:

```text
?limit=10000000
```

Set a server-side maximum.

Example:

```text
Default = 50
Maximum = 100
```

The exact values may be adjusted later.

---

# 16. Authentication Rate Limiting

Protect authentication endpoints from abuse.

Apply rate limiting to operations such as:

```text
Login
Registration
Password reset
Session-related sensitive endpoints
```

Do not implement unlimited authentication attempts.

---

# 17. API Rate Limiting

Rate-limit expensive or abuse-prone APIs where appropriate.

Especially:

```text
Authentication
Sync
Search
Large list endpoints
```

The MVP can use a simple provider-level or infrastructure-level rate limit initially.

Do not build a complicated distributed rate limiter unless needed.

---

# 18. CSRF Protection

If authentication uses cookies, ensure the application has appropriate CSRF protection.

Use the security mechanisms recommended by the chosen authentication framework.

Do not assume:

```text
SameSite cookies
```

alone automatically solve every CSRF scenario.

---

# 19. XSS Protection

Never inject raw user-provided HTML into the UI.

Avoid:

```text
dangerouslySetInnerHTML
```

unless absolutely necessary and properly sanitized.

User-controlled values such as:

```text
Notes
Description
Person name
Category name
```

must be rendered as text.

---

# 20. Security Headers

Production responses should use appropriate security headers.

Consider:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Strict-Transport-Security
```

Exact configuration depends on the deployment platform and application requirements.

Do not blindly copy a random internet security-header configuration.

---

# 21. HTTPS

Production must use HTTPS.

Never send:

```text
Authentication credentials
Session cookies
Financial data
```

over plain HTTP in production.

---

# 22. Cookies

If authentication uses cookies:

```text
HttpOnly
Secure
SameSite
```

should be configured appropriately.

Do not expose authentication tokens unnecessarily to JavaScript.

---

# 23. Secrets

Never commit:

```text
Database passwords
API keys
Authentication secrets
Encryption keys
Production credentials
```

to source control.

Use:

```text
Environment variables
Secret manager
Hosting-provider secrets
```

as appropriate.

---

# 24. Environment Variables

Separate:

```text
Development
Test
Staging
Production
```

Do not reuse production credentials locally.

Never expose server-only secrets through:

```text
NEXT_PUBLIC_*
```

or equivalent client-exposed environment variables.

---

# 25. MongoDB Access

MongoDB credentials must only be available to server-side code.

The browser must never connect directly to MongoDB.

Architecture:

```text
Browser
   ↓
Next.js API
   ↓
MongoDB
```

Never:

```text
Browser
   ↓
MongoDB
```

---

# 26. Database Permissions

Use the least privileges necessary.

The application's database user should not have unnecessary administrative permissions.

Production credentials should be different from development credentials.

---

# 27. Database Backups

Production MongoDB must have a backup strategy.

At minimum:

```text
Automated backups
Retention policy
Recovery procedure
```

A backup that has never been restored is a theory, not a backup strategy.

Test restoration periodically.

---

# 28. Financial Data Integrity

Financial operations must be atomic where required.

Shared expense:

```text
Transaction
+
Expense Splits
```

must succeed together.

Settlement:

```text
Settlement
+
Settlement Allocations
```

must succeed together.

Use MongoDB transactions where appropriate.

---

# 29. Server-Side Financial Validation

Never trust:

```text
clientBalance
remainingAmount
settledAmount
availableCredit
monthlySpending
```

from the client.

The client sends the requested operation.

The server calculates the resulting financial state.

---

# 30. Settlement Security

For settlement creation, verify:

```text
Authenticated user
Person ownership
Account ownership
Split ownership
Correct person relationship
Allocation amount
Remaining amount
Settlement total
Settlement direction
```

Perform all critical checks on the server.

---

# 31. Prevent Over-Settlement

Example:

```text
Original split = ₹500
Already settled = ₹400
Remaining = ₹100
```

Client requests:

```text
Settlement allocation = ₹150
```

Server must reject it.

Expected:

```text
OVER_SETTLEMENT
```

Do not trust the client-calculated remaining amount.

---

# 32. Concurrency Protection

Two devices may attempt to settle the same expense simultaneously.

Example:

```text
Device A → settle ₹300
Device B → settle ₹300

Original split = ₹500
```

The server must ensure:

```text
Total allocations <= ₹500
```

Use appropriate database transaction/isolation mechanisms and server-side validation.

---

# 33. Idempotency

All offline-capable financial writes should support idempotency.

Example:

```text
operationId = abc123
```

First request:

```text
Create expense
→ success
```

Retry:

```text
operationId = abc123
→ return existing result
```

Never create a duplicate financial record.

---

# 34. Error Categories

Separate errors into:

```text
Validation errors
Authentication errors
Authorization errors
Not found
Business rule violations
Conflicts
Temporary infrastructure failures
Unexpected failures
```

Do not treat every failure as:

```text
500 Internal Server Error
```

---

# 35. Error Codes

Use stable machine-readable codes.

Examples:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT

INVALID_AMOUNT
INVALID_ACCOUNT
INVALID_CATEGORY
INVALID_PERSON
INVALID_SPLIT
INVALID_SPLIT_TOTAL

INVALID_SETTLEMENT
OVER_SETTLEMENT
INVALID_SETTLEMENT_ALLOCATION

INVALID_TRANSFER
INVALID_CREDIT_CARD_PAYMENT

SYNC_CONFLICT
DUPLICATE_OPERATION
SYNC_RETRYABLE_ERROR

INTERNAL_ERROR
```

Frontend logic should use error codes rather than matching error-message strings.

---

# 36. Error Response

Use a consistent format:

```json
{
  "error": {
    "code": "INVALID_SPLIT_TOTAL",
    "message": "Split amounts must equal the expense amount.",
    "details": {}
  }
}
```

Do not return:

```json
{
  "stack": "...",
  "mongoError": "...",
  "databaseConnection": "mongodb://..."
}
```

---

# 37. User-Facing Errors

User-facing messages should explain what happened without exposing implementation details.

Bad:

```text
MongoServerError: E11000 duplicate key error collection...
```

Good:

```text
This expense has already been synchronized.
```

or:

```text
This expense was changed on another device. Please review the latest version.
```

---

# 38. Unexpected Errors

For unexpected server errors:

```text
HTTP 500
code = INTERNAL_ERROR
```

Return a generic message.

Example:

```text
Something went wrong while saving the expense.
```

Do not expose internal details to the user.

---

# 39. Error Logging

Log unexpected errors server-side.

Useful information:

```text
requestId
userId
operation type
route
error code
timestamp
environment
```

Do not unnecessarily log:

```text
Full transaction payload
Credit-card details
Authentication credentials
Session tokens
Sensitive personal information
```

---

# 40. Request IDs

Generate or propagate a request ID.

Example:

```text
requestId = req_abc123
```

Use it in:

```text
Server logs
Error responses
Support/debugging
```

Example response header:

```text
X-Request-Id: req_abc123
```

---

# 41. Sync Error Handling

Sync failures must be classified.

## Retryable

Examples:

```text
Network unavailable
Timeout
503
Temporary database failure
```

Action:

```text
Keep operation pending
Retry later
```

## Non-retryable

Examples:

```text
Invalid split
Invalid account
Unauthorized
Over-settlement
Invalid participant
```

Action:

```text
Mark operation failed
Preserve local data
Show actionable error
```

---

# 42. Never Lose Offline Data

If synchronization fails:

```text
DO NOT
delete local record
```

Instead:

```text
Local record
    ↓
syncStatus = failed
    ↓
sync operation preserved
```

The user must be able to recover.

---

# 43. Failed Sync UI

Example:

```text
Expense saved locally
Sync failed
```

Provide a way to understand:

```text
What failed
Whether the data is still safe locally
Whether retry is possible
```

Do not display a giant technical error screen.

---

# 44. Offline Conflict Handling

When the server detects a conflict:

```text
Do not silently overwrite
Do not silently merge financial amounts
Do not delete local changes
```

Instead:

```text
Fetch canonical server state
+
Preserve local change
+
Present conflict for resolution
```

The exact UX can be simplified for MVP.

---

# 45. Client Error Boundaries

Use React/Next.js error boundaries for UI failures.

A component crash should not destroy the entire application's usable state.

Provide:

```text
Friendly error state
Retry action
Navigation back to safe area
```

---

# 46. API Timeout Handling

Do not allow requests to hang indefinitely.

Use reasonable client/server timeouts where applicable.

A timeout should be treated as:

```text
Unknown result
```

not automatically:

```text
Operation definitely failed
```

This is especially important for financial writes.

If a request times out after the server may have committed it:

```text
Retry using the same operationId
```

Idempotency prevents duplicate operations.

---

# 47. Database Failure Handling

If MongoDB is unavailable:

```text
API
 ↓
503 / retryable error
```

Do not return success if the operation was not committed.

For online UI, the client may preserve the operation locally and allow synchronization later where appropriate.

---

# 48. Logging Levels

Use appropriate levels:

```text
DEBUG
INFO
WARN
ERROR
```

Development can be more verbose.

Production should avoid excessive logs.

Never log secrets.

---

# 49. Auditability

For MVP, preserve:

```text
createdAt
updatedAt
deletedAt
```

and synchronization identifiers.

Financial history should not be casually destroyed.

A future audit-log system can be added if more detailed historical tracking becomes necessary.

---

# 50. Soft Delete Security

Soft-deleted records should not appear in normal queries.

However:

```text
deletedAt
```

must remain available to synchronization and recovery logic.

Do not allow clients to resurrect arbitrary deleted records without proper authorization and domain rules.

---

# 51. Account Deletion

If the user later deletes an account:

```text
Do not immediately destroy all financial history.
```

Use an explicit account/data deletion policy.

This should be treated as a separate product/security workflow.

---

# 52. Client Storage Security

IndexedDB is not a secure vault.

Do not assume:

```text
IndexedDB = encrypted storage
```

Avoid storing:

```text
Passwords
Authentication secrets
Long-lived sensitive credentials
```

in IndexedDB.

Store only the application data necessary for offline functionality.

---

# 53. Sensitive Data in URLs

Do not put sensitive financial information into URLs.

Avoid:

```text
?amount=50000
?cardNumber=...
?notes=...
```

URLs can appear in:

```text
Browser history
Server logs
Analytics
Referrer information
```

Use request bodies where appropriate.

---

# 54. Analytics

If analytics are added later:

Do not automatically send:

```text
Expense amount
Expense description
Person names
Account names
Financial balances
```

to analytics providers.

Track product behavior rather than financial content.

Good:

```text
expense_created
shared_expense_created
settlement_created
```

Bad:

```text
expense_created:
amount=₹48,500
description="..."
account="..."
```

---

# 55. Third-Party Services

Any future third-party integration must be reviewed for:

```text
Data access
Authentication
Privacy
Data retention
Security
Failure behavior
```

Do not send financial data to external services merely because an SDK makes it convenient.

---

# 56. Dependency Security

Keep dependencies updated.

Use:

```text
npm audit
Dependabot/Renovate or equivalent
Lockfile
```

Review security advisories.

Avoid unnecessary dependencies.

Every dependency increases the amount of software you are trusting.

---

# 57. Production Security Checklist

Before production:

```text
[ ] Authentication configured
[ ] Authorization tested
[ ] Cross-user access tested
[ ] IDOR tests pass
[ ] Input validation implemented
[ ] Rate limiting configured
[ ] HTTPS enabled
[ ] Secure cookies configured
[ ] Security headers configured
[ ] Secrets removed from repository
[ ] Production environment variables secured
[ ] MongoDB access restricted
[ ] Backups enabled
[ ] Restore process tested
[ ] Error responses sanitized
[ ] Logs reviewed for sensitive data
[ ] Request IDs enabled
[ ] Idempotency implemented
[ ] Settlement concurrency tested
[ ] Offline sync failures tested
```

---

# 58. Security Testing

At minimum, test:

```text
Unauthenticated API access
Cross-user resource access
Invalid IDs
Malformed payloads
Large payloads
Invalid amounts
Over-settlement
Duplicate operations
Concurrent settlements
Expired sessions
Rate-limit behavior
```

Test the API directly.

Do not rely only on frontend behavior.

---

# 59. Threat Model

Basic threats to consider:

```text
Unauthorized user access
Stolen session
Cross-user data access
Malicious API requests
Duplicate financial operations
Offline synchronization conflicts
Database compromise
Leaked secrets
XSS
CSRF
Abusive requests
Data loss
```

The MVP architecture should specifically mitigate these threats.

---

# 60. Final Security Principle

The client is an untrusted environment.

Even though the application is primarily used by one person, assume that a malicious client can:

```text
Modify requests
Modify JavaScript
Change IDs
Change amounts
Replay requests
Send requests directly to APIs
Attempt cross-user access
```

The server must remain authoritative.

The safest financial flow is:

```text
Client requests an operation
        ↓
Authenticate
        ↓
Validate
        ↓
Authorize
        ↓
Execute domain rules
        ↓
Atomic database operation
        ↓
Return canonical result
```

Never:

```text
Client calculates financial truth
        ↓
Server blindly saves it
```

That boundary is one of the most important architectural rules in the entire application.