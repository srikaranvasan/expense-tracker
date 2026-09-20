# Expense Tracker MVP - Product Scope

## 1. Product Goal

Build a personal finance and shared-expense application that allows the user to accurately track:

- Personal expenses
- Shared expenses
- Multiple bank accounts
- Cash
- Multiple credit cards
- Money paid for other people
- Money other people paid for the user
- Outstanding balances between people
- Specific and partial settlements
- Transfers between own accounts
- Credit-card payments
- Basic financial summaries
- Offline expense entry

The application must be usable from:

- iPhone through a PWA
- Desktop web browser

The application should feel like one product across both platforms.

---

# 2. MVP Priorities

The MVP should prioritize:

1. Financial correctness
2. Extremely fast expense entry
3. Clear understanding of balances
4. Reliable account tracking
5. Shared-expense management
6. Offline-first functionality
7. Maintainable architecture

Analytics and automation are secondary to correctness.

---

# 3. MVP Features

## 3.1 Authentication

### Required

- Sign up
- Sign in
- Sign out
- Session management
- Current-user identification

### Requirements

Every user-owned resource must belong to the authenticated user.

The client must never be trusted to determine ownership.

---

# 4. Accounts

An account represents a financial account owned by the user.

## Supported account types

### Bank

Examples:

- HDFC Savings
- ICICI Savings

### Cash

Example:

- Cash

### Credit Card

Examples:

- HDFC Credit Card
- ICICI Credit Card

---

## Account fields

- Name
- Type
- Currency
- Opening balance
- Active/inactive status

---

## Credit-card fields

Credit cards additionally support:

- Credit limit
- Statement day
- Payment due day

Example:

```text
HDFC Credit Card

Credit Limit:       ₹1,50,000
Outstanding:          ₹18,500
Available Credit:   ₹1,31,500
Statement Day:              5
Payment Due Day:           25
````

Available credit should normally be derived.

Do not maintain independent mutable values for both outstanding and available credit unless there is a strong reason.

---

# 5. Categories

Users can create categories for expenses and income.

Example:

```text
Food
 ├── Restaurants
 ├── Groceries
 └── Delivery

Transport
 ├── Fuel
 ├── Uber
 └── Metro

Shopping
Bills
Entertainment
Health
Rent
Other
```

Categories should support parent/child relationships.

---

# 6. People

People are contacts used for shared expenses.

Example:

```text
Arun
Vijay
Rahul
```

A Person does not need to have an application account.

The user should be able to:

* Add person
* Edit person
* Archive person
* View transaction history
* View current balance
* View unsettled expenses
* Create settlement

---

# 7. Expenses

Expenses are the primary financial events.

## Personal Expense

Example:

```text
₹450
Dinner
Food
HDFC Credit Card
```

The expense belongs entirely to the user.

---

## Shared Expense

Example:

```text
₹1,200
Dinner

Paid by: You

Participants:
You
Arun
Vijay

Equal split:
You      ₹400
Arun     ₹400
Vijay    ₹400
```

The user's actual expense is ₹400.

Arun and Vijay owe the user ₹400 each.

---

# 8. Who Paid

Every shared expense must identify who actually paid.

Possible values:

```text
User
Person
```

Example:

```text
Paid by: You
```

or:

```text
Paid by: Arun
```

This is different from the account used.

---

# 9. Payment Account

For transactions involving the user's financial accounts, record the account.

Example:

```text
Paid by: You
Account: HDFC Credit Card
```

The concepts must remain separate:

```text
paidBy  = WHO paid
account = WHICH financial account was used
```

If another person paid, their bank account does not need to be tracked in the user's account system.

---

# 10. Expense Splits

A shared expense can contain multiple participants.

Supported split methods:

* Equal
* Custom amount
* Percentage

Example:

```text
₹1,000

You       ₹200
Arun      ₹500
Vijay     ₹300
```

The final stored split should contain monetary amounts.

Invariant:

```text
Sum of all active split amounts
=
Expense total
```

The application must prevent saving invalid splits.

---

# 11. Someone Else Pays

Example:

```text
Arun pays ₹900.

Participants:
You
Arun
```

Split:

```text
You      ₹450
Arun     ₹450
```

Result:

```text
You owe Arun ₹450
```

No separate debt transaction should be created.

The debt is derived from the expense and its splits.

---

# 12. User Pays for Others

Example:

```text
You pay ₹1,200.

Participants:
You
Arun
Vijay
```

Split:

```text
You      ₹400
Arun     ₹400
Vijay    ₹400
```

Result:

```text
Your actual expense: ₹400

Arun owes you: ₹400
Vijay owes you: ₹400
```

---

# 13. Settlements

A settlement represents actual money paid between people after a shared expense.

Example:

```text
You owe Arun ₹450

You pay Arun ₹450
```

Create:

```text
Settlement

From: You
To: Arun
Amount: ₹450
Account: HDFC Savings
```

A settlement is not an expense.

---

# 14. Settlement Allocations

A settlement can be applied to specific expense splits.

Example:

```text
You owe Arun:

Dinner       ₹300
Groceries    ₹200
Movie        ₹400
```

You pay Arun ₹300 specifically for Dinner.

The settlement is:

```text
You → Arun
₹300
```

The settlement allocation is:

```text
Dinner split → ₹300
```

Result:

```text
Dinner       Settled
Groceries    Unsettled
Movie        Unsettled
```

---

## Partial settlement

If:

```text
Groceries share = ₹500
```

and the user pays:

```text
₹200
```

then:

```text
Settled:   ₹200
Remaining: ₹300
```

The application must support this.

---

# 15. Transfers

Transfers represent movement between the user's own accounts.

Example:

```text
HDFC Savings
      ↓
ICICI Savings

₹10,000
```

This must:

* Decrease source account
* Increase destination account
* Not count as an expense
* Not affect monthly spending

---

# 16. Credit-Card Payments

Example:

```text
HDFC Savings
      ↓
HDFC Credit Card

₹15,000
```

This must:

* Decrease bank balance
* Decrease credit-card outstanding
* Not count as a new expense

The expense was already recorded when the card was used.

---

# 17. Dashboard

The dashboard should provide an immediate financial overview.

Show:

```text
Monthly Spending
₹18,420

Bank + Cash
₹72,000

Credit Card Outstanding
₹18,500

People Owe You
₹2,450

You Owe People
₹850
```

Also show:

* Recent transactions
* Upcoming card due dates where available
* Unsettled people
* Quick add actions

Avoid excessive charts in the MVP.

---

# 18. Transactions

The transaction list should show all financial events.

Types:

```text
Expense
Income
Transfer
Credit Card Payment
```

The UI must clearly distinguish them.

Example:

```text
Dinner
₹1,200
Expense

HDFC → ICICI
₹10,000
Transfer

You → Arun
₹300
Settlement
```

Settlements can appear in relevant people/transaction views even though they are not expenses.

---

# 19. Offline Support

The application must allow users to enter expenses without internet.

Basic flow:

```text
User enters expense
        ↓
Save locally
        ↓
Show immediately
        ↓
Internet returns
        ↓
Synchronize
        ↓
MongoDB
```

The user should not need to understand synchronization.

---

# 20. Search and Filtering

MVP should support:

* Search by description
* Filter by date
* Filter by category
* Filter by account
* Filter by person
* Filter by transaction type
* Filter personal/shared expenses

---

# 21. MVP Non-Goals

Do not implement initially:

* Bank API integrations
* Automatic bank transaction imports
* Credit-card API integrations
* OCR
* AI categorization
* Budgeting
* Investment tracking
* Cryptocurrency tracking
* Multi-currency conversion
* Complex financial reports
* Microservices
* Advanced notifications
* Automatic settlement optimization

These are future features.

The architecture should allow them to be added later without redesigning the core accounting model.

---

# 22. MVP Definition of Done

The MVP is considered complete when the user can:

1. Create multiple bank accounts.
2. Create cash accounts.
3. Create multiple credit cards.
4. Set credit limits.
5. Add personal expenses.
6. Add shared expenses.
7. Specify who paid.
8. Split expenses among multiple people.
9. Use equal/custom/percentage splits.
10. Record expenses paid by other people.
11. See who owes whom.
12. Select specific expense splits for settlement.
13. Partially settle expense splits.
14. Record settlements.
15. Transfer money between own accounts.
16. Pay a credit card from another account.
17. See correct account balances.
18. See correct credit-card outstanding.
19. See monthly actual spending.
20. Enter expenses while offline.
21. Synchronize offline data when online.
22. Use the application from both iPhone and desktop web.

---

# 23. Product Rule

The application should optimize for this behavior:

```text
Think of expense
      ↓
Open app
      ↓
Enter amount
      ↓
Choose basic details
      ↓
Save
```

The user should not have to perform accounting calculations manually.

The system should calculate:

* shares
* receivables
* payables
* unsettled amounts
* account balances
* credit-card outstanding
* monthly actual spending

The user's job is to record what happened.

The application's job is to figure out the accounting.

