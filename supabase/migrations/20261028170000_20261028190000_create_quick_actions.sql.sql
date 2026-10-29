/*
# Create custom quick expense actions

1. Purpose
Adds user-created quick expense shortcuts so each business can have its own one-tap expense buttons.

2. New Tables
- `quick_actions`
  - `id` uuid primary key.
  - `business_id` uuid linking the shortcut to one business.
  - `label` text shown on the button.
  - `category` text used when creating the expense.
  - `created_at` timestamptz recording when the shortcut was created.

3. Security
- Row Level Security is enabled on `quick_actions`.
- Authenticated users receive CRUD access only for shortcuts belonging to businesses they own.
- The business relationship is protected through ownership checks against `businesses`.

4. Important Notes
- Deleting a business removes its custom shortcuts through the foreign-key cascade.
- The table is additive and does not modify existing financial records.
*/

CREATE TABLE IF NOT EXISTS quick_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 40),
  category text NOT NULL CHECK (char_length(trim(category)) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, label)
);

ALTER TABLE quick_actions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON quick_actions TO authenticated;

DROP POLICY IF EXISTS "select_own_quick_actions" ON quick_actions;
CREATE POLICY "select_own_quick_actions" ON quick_actions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = quick_actions.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_quick_actions" ON quick_actions;
CREATE POLICY "insert_own_quick_actions" ON quick_actions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = quick_actions.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_quick_actions" ON quick_actions;
CREATE POLICY "update_own_quick_actions" ON quick_actions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = quick_actions.business_id AND b.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = quick_actions.business_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_quick_actions" ON quick_actions;
CREATE POLICY "delete_own_quick_actions" ON quick_actions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = quick_actions.business_id AND b.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_quick_actions_business ON quick_actions (business_id, created_at);
