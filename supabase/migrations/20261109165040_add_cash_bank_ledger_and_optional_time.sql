/*
# Cash and bank ledger support, optional transaction time, safe bank account removal

1. Purpose
Lets every transaction record which money source it affected (cash in hand or a
bank account), lets transactions be saved without a time of day, and lets bank
accounts be removed without losing or mis-stating any balance.

2. Modified Tables
- `transactions.payment_method` now also accepts 'other' (in addition to the
  existing cash, upi, card, bank, atm values). Existing rows are not changed.
- `transactions.has_time` boolean (default true). False means the transaction
  only has a date; its stored time is midnight and must not be displayed.

3. New Function
- `delete_bank_account(account_id, target_account_id)` removes a bank account in
  one step. Its transactions move to the chosen destination account, or to Cash
  in hand when no destination is given, and its opening balance is added to the
  destination so the combined total does not change. Bank charges cannot move to
  Cash in hand, because a bank charge must always belong to a bank account.
  The function runs with the caller's permissions, so row level security still
  applies, and it is only executable by signed-in users.

4. Security
- No new tables. Existing ownership policies still govern all reads and writes.
- The new function is restricted to the authenticated role.

5. Important Notes
- Existing transactions keep their values. Transactions that were recorded
  without a bank account continue to count as Cash in hand.
- All balances are derived from the transaction records and opening balances,
  so editing or deleting a transaction automatically reverses its earlier effect.
*/

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_payment_method_check
  CHECK (payment_method IN ('cash','upi','card','bank','atm','other'));

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS has_time boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION delete_bank_account(p_account_id uuid, p_target_account_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
    UPDATE businesses SET opening_balance = opening_balance + v_opening WHERE id = v_business;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = p_target_account_id AND business_id = v_business) THEN
      RAISE EXCEPTION 'Destination account not found';
    END IF;
    UPDATE bank_accounts SET opening_balance = opening_balance + v_opening WHERE id = p_target_account_id;
  END IF;

  UPDATE transactions SET bank_account_id = p_target_account_id WHERE bank_account_id = p_account_id;
  DELETE FROM bank_accounts WHERE id = p_account_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_bank_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_bank_account(uuid, uuid) TO authenticated;
