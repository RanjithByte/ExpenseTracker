/*
# Income & Expense Tracker — Core Schema

1. Purpose
This migration creates the full data model for a multi-user, multi-business
income & expense tracker. Each user owns multiple businesses. Each business
owns its transactions and categories. Data is isolated per user via RLS.

2. New Tables
- `businesses`: a user-owned financial entity (shop, personal, etc.)
  - `id` uuid PK
  - `user_id` uuid (owner, defaults to auth.uid())
  - `name` text (business name)
  - `description` text (optional)
  - `opening_balance` numeric (required starting balance)
  - `currency` text (default 'INR', display symbol derived in app)
  - `created_at` timestamptz
- `categories`: user-defined categories per business
  - `id` uuid PK
  - `business_id` uuid FK -> businesses(id) ON DELETE CASCADE
  - `name` text
  - `type` text ('income' | 'expense')
  - `created_at` timestamptz
- `transactions`: every income/expense record
  - `id` uuid PK
  - `business_id` uuid FK -> businesses(id) ON DELETE CASCADE
  - `category_id` uuid FK -> categories(id) ON DELETE SET NULL (nullable)
  - `category_name` text (denormalized for display / safety on category delete)
  - `type` text ('income' | 'expense')
  - `amount` numeric (>0)
  - `item` text (short name)
  - `description` text (optional)
  - `payment_method` text ('cash'|'upi'|'card'|'bank'|'atm')
  - `notes` text (optional)
  - `reference` text (optional reference number)
  - `txn_date` timestamptz (date+time the transaction occurred)
  - `created_at` timestamptz

3. Security
- RLS enabled on businesses, categories, transactions.
- Grants limited to `authenticated` (this app has sign-in).
- businesses: owner-scoped CRUD via auth.uid() = user_id.
- categories: CRUD scoped through ownership of parent business.
- transactions: CRUD scoped through ownership of parent business.
- Indexes added on common filter/sort columns.

4. Notes
- `category_name` is denormalized so history remains readable if a category
  is later deleted (FK is SET NULL).
- `businesses.user_id` has DEFAULT auth.uid() so client inserts without
  passing user_id still satisfy the INSERT WITH CHECK policy.
*/

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON businesses TO authenticated;

DROP POLICY IF EXISTS "select_own_businesses" ON businesses;
CREATE POLICY "select_own_businesses" ON businesses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_businesses" ON businesses;
CREATE POLICY "insert_own_businesses" ON businesses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_businesses" ON businesses;
CREATE POLICY "update_own_businesses" ON businesses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_businesses" ON businesses;
CREATE POLICY "delete_own_businesses" ON businesses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense' CHECK (type IN ('income','expense')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name, type)
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;

DROP POLICY IF EXISTS "select_own_categories" ON categories;
CREATE POLICY "select_own_categories" ON categories FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_categories" ON categories;
CREATE POLICY "insert_own_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_categories" ON categories;
CREATE POLICY "update_own_categories" ON categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_categories" ON categories;
CREATE POLICY "delete_own_categories" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  category_name text,
  type text NOT NULL CHECK (type IN ('income','expense')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  item text NOT NULL,
  description text,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','upi','card','bank','atm')),
  notes text,
  reference text,
  txn_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO authenticated;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = transactions.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = transactions.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = transactions.business_id AND b.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = transactions.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = transactions.business_id AND b.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_transactions_business_date ON transactions (business_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_business_type ON transactions (business_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_business_category ON transactions (business_id, category_id);
CREATE INDEX IF NOT EXISTS idx_categories_business ON categories (business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses (user_id);
