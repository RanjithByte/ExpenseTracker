/*
# Add bank accounts and automatic bank deductions

1. Purpose
Lets each business track bank accounts and record automatic bank deductions
(SMS charges, debit card annual fees, credit card charges, ATM charges, minimum
balance penalties, account maintenance fees, GST and other service charges).

2. New Tables
- `bank_accounts`: a bank account belonging to a business.
  - `id` uuid primary key.
  - `business_id` uuid linking the account to one business.
  - `name` text, the account label (unique per business).
  - `opening_balance` numeric, the starting balance before any deductions.
  - `created_at` timestamptz.

3. Modified Tables
- `transactions` gains three optional columns:
  - `is_bank_charge` boolean (default false). True for automatic bank deductions.
  - `bank_account_id` uuid, the account the deduction was taken from.
  - `deduction_type` text, the deduction label (predefined or custom).
  Existing rows are unchanged: they default to not being bank charges.

4. Security
- Row Level Security is enabled on `bank_accounts`.
- Authenticated users get CRUD access only for accounts in businesses they own,
  using the same ownership check as the other tables.

5. Important Notes
- Deleting a bank account that still has deductions is blocked, so charge history
  is never lost.
- A bank charge must reference a bank account.
- Tracked account balances are calculated from the opening balance minus the
  deductions recorded against the account, so editing or deleting a deduction
  updates the balance automatically.
*/

CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON bank_accounts TO authenticated;

DROP POLICY IF EXISTS "select_own_bank_accounts" ON bank_accounts;
CREATE POLICY "select_own_bank_accounts" ON bank_accounts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = bank_accounts.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_bank_accounts" ON bank_accounts;
CREATE POLICY "insert_own_bank_accounts" ON bank_accounts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = bank_accounts.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_bank_accounts" ON bank_accounts;
CREATE POLICY "update_own_bank_accounts" ON bank_accounts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = bank_accounts.business_id AND b.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = bank_accounts.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_bank_accounts" ON bank_accounts;
CREATE POLICY "delete_own_bank_accounts" ON bank_accounts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = bank_accounts.business_id AND b.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_bank_accounts_business ON bank_accounts (business_id);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_bank_charge boolean NOT NULL DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deduction_type text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_bank_charge_requires_account') THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_bank_charge_requires_account
      CHECK (NOT is_bank_charge OR bank_account_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_deduction_type_length') THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_deduction_type_length
      CHECK (deduction_type IS NULL OR char_length(trim(deduction_type)) BETWEEN 1 AND 60);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON transactions (bank_account_id);
