-- Partial unique index so each (group, slot) can only exist once.
-- Allows ON CONFLICT upsert when an actual scraped payment replaces a synthetic future row.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_installment_slot_idx
  ON transactions (user_id, installment_group_id, installment_current)
  WHERE installment_group_id IS NOT NULL;
