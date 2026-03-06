-- Fix Madison Villamaino #6478 and #6479: status is 'batched' and batch_id is set,
-- but batch_items junction rows were never created (partial failure before atomic RPC).
-- The batch "Print Batch - Early January 2026" exists and is confirmed with 7 other items.

INSERT INTO batch_items (batch_id, work_item_id, position)
VALUES
  ('9c91cd76-41d5-4b80-8dfa-ab62ebb8471f', 'a1316560-c1e7-4a1e-a1b8-0a1d15464237', 8),
  ('9c91cd76-41d5-4b80-8dfa-ab62ebb8471f', 'b9065c4b-c4a0-42c3-a3d3-fa070520d3bd', 9)
ON CONFLICT DO NOTHING;

UPDATE work_items
SET batched_at = '2026-02-03T21:59:08+00:00'
WHERE id IN ('a1316560-c1e7-4a1e-a1b8-0a1d15464237', 'b9065c4b-c4a0-42c3-a3d3-fa070520d3bd')
  AND batched_at IS NULL;
