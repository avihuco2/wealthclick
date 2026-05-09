-- Merge mirror-pair installment groups created by Max RTL bug.
-- After 018 (same-date reversed dups), mirror series still coexist under different
-- group_ids because makeInstallmentGroupId fed the non-canonicalized description.
--
-- Strategy:
-- 1. Find reversed-description group pairs matching on (user_id, account, amount, total).
-- 2. For each (group_pair, installment_current) with two rows, keep the one that has an
--    external_id (real scraped row beats synthetic forecast). Tie-breaker: earlier created_at.
-- 3. After deleting conflicts, reassign any surviving rows from the non-canonical group
--    to the canonical group (alphabetically smaller description per new scraper code).

WITH pairs AS (
  SELECT DISTINCT
    LEAST(t1.installment_group_id, t2.installment_group_id)    AS g_a,
    GREATEST(t1.installment_group_id, t2.installment_group_id) AS g_b
  FROM transactions t1
  JOIN transactions t2
    ON t1.user_id = t2.user_id
   AND t1.account = t2.account
   AND t1.amount  = t2.amount
   AND t1.installment_total = t2.installment_total
   AND t1.installment_group_id IS NOT NULL
   AND t2.installment_group_id IS NOT NULL
   AND t1.installment_group_id <> t2.installment_group_id
   AND t1.description = reverse(t2.description)
),
-- For every conflicting (pair, current_month), pick loser by (has_external_id ASC, created_at DESC)
losers AS (
  SELECT t.id
  FROM transactions t
  JOIN pairs p
    ON t.installment_group_id IN (p.g_a, p.g_b)
  WHERE EXISTS (
    SELECT 1 FROM transactions t2
    WHERE t2.installment_group_id IN (p.g_a, p.g_b)
      AND t2.installment_current = t.installment_current
      AND t2.id <> t.id
  )
    AND t.id <> (
      SELECT tt.id FROM transactions tt
      WHERE tt.installment_group_id IN (p.g_a, p.g_b)
        AND tt.installment_current = t.installment_current
      ORDER BY
        (tt.external_id IS NOT NULL) DESC,
        tt.created_at ASC
      LIMIT 1
    )
)
DELETE FROM transactions WHERE id IN (SELECT id FROM losers);

-- Reassign surviving non-canonical rows to canonical group
-- Canonical = alphabetically-smaller description (matches makeInstallmentGroupId canonicalization)
WITH pairs AS (
  SELECT DISTINCT
    LEAST(t1.installment_group_id, t2.installment_group_id)    AS g_a,
    GREATEST(t1.installment_group_id, t2.installment_group_id) AS g_b
  FROM transactions t1
  JOIN transactions t2
    ON t1.user_id = t2.user_id
   AND t1.account = t2.account
   AND t1.amount  = t2.amount
   AND t1.installment_total = t2.installment_total
   AND t1.installment_group_id IS NOT NULL
   AND t2.installment_group_id IS NOT NULL
   AND t1.installment_group_id <> t2.installment_group_id
   AND t1.description = reverse(t2.description)
),
-- Pick canonical group (the one whose description is alphabetically smaller)
canonical_map AS (
  SELECT
    p.g_a, p.g_b,
    (SELECT description FROM transactions WHERE installment_group_id = p.g_a LIMIT 1) AS desc_a,
    (SELECT description FROM transactions WHERE installment_group_id = p.g_b LIMIT 1) AS desc_b
  FROM pairs p
),
resolved AS (
  SELECT
    CASE WHEN desc_a <= desc_b THEN g_a ELSE g_b END AS canonical_g,
    CASE WHEN desc_a <= desc_b THEN g_b ELSE g_a END AS non_canonical_g,
    CASE WHEN desc_a <= desc_b THEN desc_a ELSE desc_b END AS canonical_desc
  FROM canonical_map
)
UPDATE transactions t
SET installment_group_id = r.canonical_g,
    description = r.canonical_desc
FROM resolved r
WHERE t.installment_group_id = r.non_canonical_g;
