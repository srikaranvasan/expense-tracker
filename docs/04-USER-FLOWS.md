# Expense Tracker MVP - User Flows

## 1. UX Objective

The application should optimize for:

> Record what happened quickly, then let the application handle the accounting.

The user should not need to manually calculate:

- Their share
- What friends owe them
- What they owe friends
- Remaining settlement amounts
- Account balances
- Credit-card outstanding

The application calculates these values from the underlying financial events.

---

# 2. Main Navigation

## Mobile

Use a bottom navigation:

```text
Home
Transactions
+
People
More
````

The `+` action should be prominent because adding an expense is the most frequent action.

Both navigations are the same component tree rendered at different breakpoints
using Chakra's responsive props. Do not build and maintain two separate
navigation implementations.

## Desktop

Use a sidebar:

```text
Home
Transactions
Accounts
People
Categories
Reports
Settings
```

---

# 3. Home Dashboard

The dashboard should answer:

> "What is my current financial situation?"

Example:

```text
--------------------------------
Total Balance
₹72,450

Credit Card Outstanding
₹18,500

People Owe Me
₹2,450

I Owe People
₹850
--------------------------------

This Month
₹18,420 spent

Recent Transactions
...
```

Primary actions:

```text
+ Expense
+ Transfer
+ Settlement
```

Potential later action:

```text
+ Income
```

---

# 4. Add Expense - Core Flow

The add-expense experience is the most important flow in the application.

Initial UI:

```text
Amount
₹450

Description
Dinner

Category
Food

Paid using
HDFC Credit Card

[ Personal ] [ Split ]

Save
```

The initial form should expose only the fields needed for a normal personal expense.

Advanced split controls should appear only when the user chooses Split.

---

# 5. Personal Expense

Example:

```text
Amount
₹450

Description
Dinner

Category
Food

Account
HDFC Credit Card

Date
Today

Notes
Optional
```

User presses:

```text
Save
```

Expected result:

```text
Expense saved
```

The transaction immediately appears in:

* Dashboard
* Transactions
* Account history
* Monthly spending

---

# 6. Shared Expense - User Paid

Example:

```text
Amount
₹1,200

Description
Dinner

Paid by
Me

Paid using
HDFC Credit Card

Split with

☑ Me
☑ Arun
☑ Vijay
```

Split method:

```text
Equal
Custom
Percentage
```

For Equal:

```text
You       ₹400
Arun      ₹400
Vijay     ₹400
```

The user confirms:

```text
Save
```

Result:

```text
Your actual expense = ₹400

Arun owes you = ₹400
Vijay owes you = ₹400
```

The user's credit card was charged ₹1,200.

The user's actual share is ₹400.

These must remain separate concepts.

---

# 7. Shared Expense - Someone Else Paid

Example:

```text
Amount
₹900

Description
Dinner

Paid by
Arun

Participants
☑ Me
☑ Arun
```

The application calculates:

```text
You       ₹450
Arun      ₹450
```

Result:

```text
You owe Arun ₹450
```

No money is deducted from the user's account.

The expense still appears in the user's transaction history because it is relevant to their financial responsibility.

---

# 8. Equal Split

Example:

```text
Total: ₹1,200

Participants:
You
Arun
Vijay
```

The application calculates:

```text
₹400 each
```

The user should not need to manually calculate the share.

If rounding is required, use the centralized money calculation logic.

The final shares must always equal the transaction total.

---

# 9. Custom Split

Example:

```text
Total: ₹1,000

You       ₹200
Arun      ₹500
Vijay     ₹300

Remaining: ₹0
```

If the entered values do not equal the total:

```text
Total: ₹1,000

Entered: ₹900

Remaining: ₹100
```

The Save action should remain disabled until the split is valid.

Do not silently modify the user's entered values.

---

# 10. Percentage Split

Example:

```text
Total: ₹1,000

You       50%
Arun      30%
Vijay     20%
```

Preview:

```text
You       ₹500
Arun      ₹300
Vijay     ₹200
```

Persist the final monetary shares.

The UI can retain the percentage input as presentation state, but the financial record should have definitive monetary values.

---

# 11. Expense Details

Example:

```text
Dinner
₹1,200

Aug 22 · Food

Paid by
You

Account
HDFC Credit Card

Split

You       ₹400
Arun      ₹400
Vijay     ₹400

Settlement Status

You       -
Arun      Unsettled
Vijay     Settled
```

Actions:

```text
Edit
Delete
```

If unsettled:

```text
Settle
```

---

# 12. People Screen

Show current net balance with each person.

Example:

```text
People

Arun
You owe ₹450

Vijay
Owes you ₹800

Rahul
Settled
```

Direction must always be explicit.

Avoid ambiguous displays such as:

```text
Arun ₹450
```

Prefer:

```text
You owe Arun ₹450
```

or:

```text
Arun owes you ₹450
```

---

# 13. Person Details

Example:

```text
Arun

You owe Arun
₹750
```

Then list relevant expense splits:

```text
Unsettled

Dinner
Aug 20
₹300

Groceries
Aug 21
₹450
```

And settled items:

```text
Settled

Movie
Aug 10
₹400
```

Primary action:

```text
Settle
```

---

# 14. Settlement Flow

A settlement is an actual payment between people.

Example:

```text
You owe Arun ₹750
```

User taps:

```text
Settle
```

Show:

```text
Select expenses to settle

☑ Dinner       ₹300
☐ Groceries    ₹450

Selected
₹300
```

Then:

```text
Pay from
HDFC Savings

Amount
₹300

Confirm Settlement
```

After confirmation:

```text
Dinner
✓ Settled

Groceries
Unsettled ₹450

You owe Arun
₹450
```

---

# 15. Partial Settlement

Example:

```text
Groceries
Your share: ₹500
```

User wants to pay only ₹200.

Settlement:

```text
₹200
```

Result:

```text
Groceries

Original:  ₹500
Settled:   ₹200
Remaining: ₹300
```

The UI should clearly show the remaining amount.

---

# 16. Settlement Allocation

A settlement may cover multiple specific expense splits.

Example:

```text
You owe Arun:

Dinner       ₹300
Groceries    ₹500
Movie        ₹400
```

User pays:

```text
₹500
```

Allocates:

```text
Dinner       ₹300
Movie        ₹200
```

Result:

```text
Dinner
✓ Fully settled

Groceries
₹500 remaining

Movie
₹200 settled
₹200 remaining
```

The application must preserve these allocations.

---

# 17. Transfer Flow

Example:

```text
From
HDFC Savings

To
ICICI Savings

Amount
₹10,000

Transfer
```

Result:

```text
HDFC Savings   -₹10,000
ICICI Savings  +₹10,000
```

Monthly spending does not change.

The transaction should be visually identified as a transfer.

---

# 18. Credit-Card Payment Flow

Example:

```text
Credit Card
HDFC Swiggy

Outstanding
₹18,500
```

User selects:

```text
Pay Card
```

Flow:

```text
From
HDFC Savings

To
HDFC Swiggy

Amount
₹10,000
```

After confirmation:

```text
HDFC Savings
-₹10,000

Credit Card Outstanding
₹18,500 → ₹8,500
```

Monthly spending does not increase.

---

# 19. Account Flow

Accounts screen:

```text
Bank Accounts

HDFC Savings
₹42,500

ICICI Savings
₹28,300

Cash
₹2,000

Credit Cards

HDFC Swiggy
₹8,500 outstanding
₹1,50,000 limit
```

Selecting an account shows:

* Current balance
* Recent transactions
* Account information
* Transfer action

---

# 20. Credit Card Flow

Credit-card details:

```text
HDFC Swiggy

Outstanding
₹8,500

Credit Limit
₹1,50,000

Available
₹1,41,500

Statement Date
5th

Payment Due
25th
```

Available credit should be derived.

Show card spending by category when useful.

---

# 21. Transactions Flow

Transaction list:

```text
August 22

Dinner
₹1,200
HDFC Credit Card
Shared

Groceries
₹850
HDFC Savings
Personal

August 21

Movie
₹900
Paid by Arun
Your share ₹450
```

Filters:

```text
Date
Category
Account
Person
Type
Personal / Shared
```

Search:

```text
Dinner
Amazon
Fuel
Arun
```

---

# 22. Quick Inbox

Because users may remember expenses later, support incomplete quick captures.

Example:

```text
Quick Add

250 tea
820 zomato
1400 dinner Arun
399 amazon
600 petrol
```

Each item can initially be incomplete.

Example:

```text
Needs Attention

₹250 Tea
Missing account

₹1,400 Dinner
Missing participants
```

The user can complete them later.

---

# 23. Offline Flow

When offline:

```text
User
 ↓
Add expense
 ↓
Save locally
 ↓
Show immediately
```

Display a subtle status:

```text
Saved offline
Will sync when you're online
```

When online:

```text
Local expense
 ↓
Sync
 ↓
Server
 ↓
MongoDB
```

After success:

```text
Synced
```

Do not block normal expense entry because of connectivity.

---

# 24. Loading States

Every screen that can wait for data should have a deliberate loading state.

Avoid blank screens.

Examples:

```text
Loading transactions...
```

Prefer skeleton UI where appropriate.

---

# 25. Empty States

Every list should have a useful empty state.

Example:

```text
No expenses yet.

Add your first expense.
```

People:

```text
No people yet.

Add someone when you split an expense.
```

Accounts:

```text
No accounts yet.

Add a bank account, card, or cash account.
```

---

# 26. Error States

Errors should be understandable.

Bad:

```text
MongoServerError: E11000
```

Good:

```text
This expense could not be saved.

Your changes are still stored locally and will be retried.
```

For invalid splits:

```text
Split amounts must equal ₹1,200.
₹100 is still unallocated.
```

---

# 27. Confirmation Rules

Avoid confirmation dialogs for trivial actions where possible.

For destructive operations:

```text
Delete Expense?
```

If the expense has settlement allocations, do not silently delete it.

Explain the consequence and require an appropriate correction flow.

---

# 28. UX Consistency

Use consistent terminology throughout the application.

Prefer:

```text
Expense
Split
Paid by
Account
Settlement
Settlement
Allocation
Transfer
Credit-card payment
```

Avoid switching terminology such as:

```text
Debt
IOU
Payment
Repayment
Settlement
```

unless they have intentionally different meanings.

---

# 29. Important UX Distinctions

The UI must clearly distinguish:

### Expense

```text
Dinner
₹1,200
```

### Settlement

```text
You → Arun
₹300
```

### Transfer

```text
HDFC → ICICI
₹10,000
```

### Credit-card payment

```text
HDFC Savings → HDFC Credit Card
₹10,000
```

These events have different accounting effects.

---

# 30. UX Success Criteria

The MVP UX succeeds if the user can:

```text
Open app
 ↓
Add ₹500 expense
 ↓
Save
```

in a few seconds.

And for a shared expense:

```text
Add expense
 ↓
Select Split
 ↓
Select people
 ↓
Select who paid
 ↓
Save
```

without manually calculating debts.

The application should answer:

```text
What did I actually spend?
What did I pay for others?
What did others pay for me?
Who owes me?
Who do I owe?
Which expenses are unsettled?
Which specific expenses have been settled?
How much remains?
Where did my money go?
How much do I owe on my cards?
```

without requiring the user to perform accounting manually.

