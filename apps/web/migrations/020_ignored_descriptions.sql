-- Per-bank-account ignored descriptions list.
-- Scraper skips importing any transaction whose trimmed description is in this list.
-- Used to suppress Hapoalim's credit-card aggregation rows (e.g. "מקס איט פיננסי")
-- that duplicate the detailed charges already imported by per-card scrapers (Max, Isracard, CAL).

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS ignored_descriptions TEXT[] NOT NULL DEFAULT '{}';

-- Seed Hapoalim accounts with the 5 known aggregation descriptions.
-- Safe: these descriptions only appear on Hapoalim accounts, never on card scrapers.
UPDATE bank_accounts
SET ignored_descriptions = ARRAY[
  'מקס איט פיננסי',
  'כאל',
  'מסטרקרד',
  'כרטיסי אשראי',
  'כרטיסי אשראי ל'
]
WHERE company_id = 'hapoalim'
  AND cardinality(ignored_descriptions) = 0;

-- Delete existing rows that match the seeded patterns on Hapoalim accounts.
DELETE FROM transactions t
WHERE EXISTS (
  SELECT 1 FROM bank_accounts b
  WHERE b.user_id = t.user_id
    AND b.company_id = 'hapoalim'
    AND trim(t.description) = ANY(b.ignored_descriptions)
);
