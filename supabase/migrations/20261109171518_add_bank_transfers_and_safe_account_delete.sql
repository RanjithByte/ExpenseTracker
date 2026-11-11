/*
# Add bank-to-bank transfers and update safe bank account deletion

1. New Tables
- `bank_transfers`: money moved from one bank account to another inside the same business.
  - `id`, `business_id`, `from_account_id`, `to_account_id`, `amount` (> 0), `note`, `txn_date`, `has_time`, `created_at`.
  - A transfer can never start and end on the same account.

2. Modified Functions
- `delete_bank_account`: when an account is deleted, its transfers are moved to the chosen destination account.
  Transfers cannot be moved to cash in hand, so a destination account is required when transfers exist.
  Deletion is refused if moving transfers would make one start and end on the same account.

3. Security
- Row level security enabled on `bank_transfers`.
- Access is limited to signed-in owners of the business, matching the existing bank account policies.
- Insert and update also require both accounts to belong to the same business as the transfer.

4. Important Notes
- Transfers do not change cash in hand or the combined total; they only move money between bank balances.
*/

CREATE TABLE IF NOT EXISTS bank_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  to_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  note text,
  txn_date timestamptz NOT NULL,
  has_time boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS bank_transfers_business_id_idx ON bank_transfers (business_id);
CREATE INDEX IF NOT EXISTS bank_transfers_from_account_idx ON bank_transfers (from_account_id);
CREATE INDEX IF NOT EXISTS bank_transfers_to_account_idx ON bank_transfers (to_account_id);

ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON bank_transfers TO authenticated;

DROP POLICY IF EXISTS "select_own_bank_transfers" ON bank_transfers;
CREATE POLICY "select_own_bank_transfers" ON bank_transfers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = bank_transfers.business_id AND b.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "insert_own_bank_transfers" ON bank_transfers;
CREATE POLICY "insert_own_bank_transfers" ON bank_transfers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = bank_transfers.business_id AND b.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM bank_accounts a
    WHERE a.id = bank_transfers.from_account_id AND a.business_id = bank_transfers.business_id
  )
  AND EXISTS (
    SELECT 1 FROM bank_accounts a
    WHERE a.id = bank_transfers.to_account_id AND a.business_id = bank_transfers.business_id
  )
);

DROP POLICY IF EXISTS "update_own_bank_transfers" ON bank_transfers;
CREATE POLICY "update_own_bank_transfers" ON bank_transfers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = bank_transfers.business_id AND b.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = bank_transfers.business_id AND b.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM bank_accounts a
    WHERE a.id = bank_transfers.from_account_id AND a.business_id = bank_transfers.business_id
  )
  AND EXISTS (
    SELECT 1 FROM bank_accounts a
    WHERE a.id = bank_transfers.to_account_id AND a.business_id = bank_transfers.business_id
  )
);

DROP POLICY IF EXISTS "delete_own_bank_transfers" ON bank_transfers;
CREATE POLICY "delete_own_bank_transfers" ON bank_transfers FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = bank_transfers.business_id AND b.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.delete_bank_account(p_account_id uuid, p_target_account_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_business uuid;
  v_opening numeric;
BEGIN
  SELECT business_id, opening_balance INTO v_business, v_opening
  FROM bank_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank account not found';
  END IF;

  IF p_target_account_id = p_account_id THEN
    RAISE EXCEPTION 'Choose a different account to move the history to';
  END IF;

  IF p_target_account_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM transactions WHERE bank_account_id = p_account_id AND is_bank_charge) THEN
      RAISE EXCEPTION 'Bank charges must be moved to another bank account';
    END IF;
    IF EXISTS (SELECT 1 FROM bank_transfers WHERE from_account_id = p_account_id OR to_account_id = p_account_id) THEN
      RAISE EXCEPTION 'Transfers must be moved to another bank account';
    END IF;
    UPDATE businesses SET opening_balance = opening_balance + v_opening WHERE id = v_business;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = p_target_account_id AND business_id = v_business) THEN
      RAISE EXCEPTION 'Destination account not found';
    END IF;
    UPDATE bank_accounts SET opening_balance = opening_balance + v_opening WHERE id = p_target_account_id;
  END IF;

  UPDATE transactions SET bank_account_id = p_target_account_id WHERE bank_account_id = p_account_id;
  UPDATE bank_transfers SET from_account_id = p_target_account_id WHERE from_account_id = p_account_id;
  UPDATE bank_transfers SET to_account_id = p_target_account_id WHERE to_account_id = p_account_id;

  IF EXISTS (SELECT 1 FROM bank_transfers WHERE from_account_id = to_account_id) THEN
    RAISE EXCEPTION 'Moving this account would turn a transfer into a transfer to the same account';
  END IF;

  DELETE FROM bank_accounts WHERE id = p_account_id;
END;
$function$;
