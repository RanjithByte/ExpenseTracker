# Project memory

## Product intent & audience

- Personal finance / expense tracking app for an individual managing cash and multiple bank accounts.
- Core goal: maintain accurate separate and combined balances for cash and bank accounts, with transaction history that updates balances automatically on add/edit/delete.

## Brand personality & voice

- Practical, clear, utility-focused. Production-quality but not flashy.
- Confirmation dialogs and safe-delete flows imply a careful, non-destructive tone.

## Visual design & UX direction

- Built with Vite + React + TypeScript, Tailwind CSS, Lucide React icons.
- Dashboard displays four balance cards: Total Balance, Cash in Hand, Total in Banks, and per-account breakdown table.
- Transaction form uses a toggle to optionally hide the time picker (date-only entries show just the date across lists, history, calendar, and bank charges views).
- Calendar view shows the **count of transactions** per day instead of monetary amounts; income and expense counts displayed **side by side** on each day (green for income, red for expenses), with an explanatory note beneath the calendar.
- Persistent UX: last-selected payment method and bank account are remembered across refreshes and navigation; changing payment method does not reset the selected bank account.
- Safe-delete flow for bank accounts includes a destination picker (move history to cash or another account).
- Navigation is page-based (in-memory page state). Browser back/forward buttons now navigate between in-app pages via history entries rather than exiting the site.

## Decisions, constraints & rationale

- Payment methods: Cash, UPI, Debit Card, Bank Transfer, Other. Bank-based methods (UPI, Debit Card, Bank Transfer) require account selection; Cash deducts from Cash in Hand only. Bank transactions never deduct from cash.
- Bank accounts support add/edit/delete with custom names and opening balances.
- Deleting a bank account moves its transaction history to a chosen destination (cash or another account) to keep total balance correct.
- State managed via React context; a database layer exists with delete functions already available.
- Calendar component was refactored to use transaction counts with side-by-side income/expense layout; currency input previously tied to the calendar was removed from the two pages that used it.
- Browser history integration added: each page navigation pushes a history entry; popstate listener restores the corresponding page so back/forward stay within the app.
- `@/` path alias maps to `src/`. No extra UI/icon packages beyond what the template provides.
- Typecheck and build pass in this environment after installing existing dependencies.

## Open questions & assumptions

- Transactions header and Profile page still compute balance without bank opening balances — does not match Dashboard total yet; needs alignment.
- Transfers between accounts (cash↔bank, bank↔bank) are not yet implemented; a separate transfer option is expected.
- No browser testing was performed; screens are unverified at runtime, including the updated calendar side-by-side layout and back/forward navigation behavior.
- User referenced an uploaded image that did not come through; "side" was interpreted as side-by-side income/expense counts. May need revisiting if the image resurfaces.