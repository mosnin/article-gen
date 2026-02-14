-- Add admin audit fields for credit_transactions
ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS performed_by uuid references auth.users(id) on delete set null,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS request_id text;
