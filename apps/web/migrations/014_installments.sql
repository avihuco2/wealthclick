ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS installment_total    INT CHECK (installment_total >= 1),
  ADD COLUMN IF NOT EXISTS installment_current  INT CHECK (installment_current >= 1),
  ADD COLUMN IF NOT EXISTS installment_group_id UUID;

CREATE INDEX IF NOT EXISTS transactions_installment_group_idx
  ON transactions (installment_group_id)
  WHERE installment_group_id IS NOT NULL;
