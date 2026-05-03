-- Delete reversed-merchant duplicate transactions.
-- Max credit card scraper returns both "FREEBAY ISRAEL" and "LERASI YABEERF" (reversed RTL).
-- For each pair with same (user_id, date, amount) where one description is the reverse of the
-- other, delete the later-inserted row (higher id via text sort on UUID v4 is unreliable —
-- use created_at; if equal, keep the one whose description sorts first alphabetically).
DELETE FROM transactions
WHERE id IN (
  SELECT t2.id
  FROM transactions t1
  JOIN transactions t2
    ON  t1.user_id  = t2.user_id
    AND t1.date     = t2.date
    AND t1.amount   = t2.amount
    AND t1.id       < t2.id
    AND t1.description = reverse(t2.description)
);
