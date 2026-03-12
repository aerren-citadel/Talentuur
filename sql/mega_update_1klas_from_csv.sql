-- Mega update uit bronbestand:
-- C:\Users\AnoukErren\Downloads\1 klas talent.csv
-- Geparseerd op: 2026-03-12
--
-- Dit script doet:
-- 1) talenten (actueel + historisch) upserten
-- 2) 3 historische periodes voor jaar 1 aanmaken (2026-2027) indien nog niet aanwezig
-- 3) leerlingen upserten (alleen leerlingnummer + klas, AVG-proof)
-- 4) historische indelingen (tal1/tal2/tal3) naar assignments schrijven

BEGIN;

-- 1) Talenten upserten
INSERT INTO talents (code, label, allow_repeat, is_active, sort_order) VALUES
  ('art', 'Art', FALSE, TRUE, 1),
  ('keuken', 'Keuken', FALSE, TRUE, 2),
  ('sportorientatie1', 'Sportorientatie 1', TRUE, TRUE, 3),
  ('sportorientatie2', 'Sportorientatie 2', TRUE, TRUE, 4),
  ('fotografie', 'Fotografie', FALSE, TRUE, 5),
  ('tsi', 'TSI', FALSE, TRUE, 6),
  ('virtualreality', 'Virtual Reality', FALSE, TRUE, 7),
  ('lerenindepraktijk', 'Leren in de praktijk', FALSE, TRUE, 8),
  ('creatiefschrijven', 'Creatief schrijven', FALSE, TRUE, 9),
  ('uiterlijkeverzorging', 'Uiterlijke verzorging', FALSE, TRUE, 10),
  ('juniortechnovium', 'Junior Technovium', FALSE, TRUE, 11),
  ('film', 'Film', FALSE, TRUE, 12),
  ('economieondernemen', 'Economie en ondernemen', FALSE, TRUE, 13),
  ('zorgwelzijn', 'Zorg en welzijn', FALSE, TRUE, 14),
  ('keramiek', 'Keramiek', FALSE, TRUE, 15),
  ('science', 'Science', FALSE, FALSE, 16),
  ('spaans', 'Spaans', FALSE, FALSE, 17),
  ('nask', 'NaSk', FALSE, FALSE, 18)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    allow_repeat = EXCLUDED.allow_repeat,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;

-- 2) Historische periodes aanmaken (jaar 1, schooljaar 2026-2027)
INSERT INTO periods (name, school_year, year_level, period_number, is_open, available_talents)
SELECT p.name, '2026-2027', 1, p.period_number, FALSE, p.available_talents
FROM (
  VALUES
    (1, 'Jaar 1 - Periode 1 (historische import)', ARRAY['art','keuken','sportorientatie1','sportorientatie2','fotografie','tsi','virtualreality','lerenindepraktijk','creatiefschrijven','uiterlijkeverzorging','juniortechnovium','film','economieondernemen','zorgwelzijn','keramiek','science','spaans','nask']::TEXT[]),
    (2, 'Jaar 1 - Periode 2 (historische import)', ARRAY['art','keuken','sportorientatie1','sportorientatie2','fotografie','tsi','virtualreality','lerenindepraktijk','creatiefschrijven','uiterlijkeverzorging','juniortechnovium','film','economieondernemen','zorgwelzijn','keramiek','science','spaans','nask']::TEXT[]),
    (3, 'Jaar 1 - Periode 3 (historische import)', ARRAY['art','keuken','sportorientatie1','sportorientatie2','fotografie','tsi','virtualreality','lerenindepraktijk','creatiefschrijven','uiterlijkeverzorging','juniortechnovium','film','economieondernemen','zorgwelzijn','keramiek','science','spaans','nask']::TEXT[])
) AS p(period_number, name, available_talents)
WHERE NOT EXISTS (
  SELECT 1
  FROM periods x
  WHERE x.school_year = '2026-2027'
    AND x.year_level = 1
    AND x.period_number = p.period_number
);

-- 3) Staging data uit CSV (tal1/tal2/tal3 -> p1/p2/p3)
DROP TABLE IF EXISTS import_1klas_talent;
CREATE TEMP TABLE import_1klas_talent (
  student_number TEXT NOT NULL,
  class_name TEXT NOT NULL,
  p1_code TEXT NOT NULL,
  p2_code TEXT NOT NULL,
  p3_code TEXT NOT NULL
);

INSERT INTO import_1klas_talent (student_number, class_name, p1_code, p2_code, p3_code) VALUES
  ('5825', '1a2', 'virtualreality', 'creatiefschrijven', 'uiterlijkeverzorging'),
  ('5728', '1a2', 'tsi', 'keuken', 'uiterlijkeverzorging'),
  ('5796', '1a2', 'film', 'fotografie', 'uiterlijkeverzorging'),
  ('5623', '1a1', 'sportorientatie1', 'uiterlijkeverzorging', 'economieondernemen'),
  ('5556', '1a2', 'film', 'uiterlijkeverzorging', 'lerenindepraktijk'),
  ('5886', '1a2', 'virtualreality', 'juniortechnovium', 'creatiefschrijven'),
  ('5677', '1a2', 'film', 'fotografie', 'uiterlijkeverzorging'),
  ('5828', '1a1', 'sportorientatie1', 'creatiefschrijven', 'economieondernemen'),
  ('5649', '1a1', 'tsi', 'keuken', 'economieondernemen'),
  ('5727', '1a1', 'film', 'fotografie', 'economieondernemen'),
  ('5635', '1a2', 'film', 'uiterlijkeverzorging', 'lerenindepraktijk'),
  ('5639', '1a1', 'sportorientatie1', 'uiterlijkeverzorging', 'economieondernemen'),
  ('5730', '1a1', 'spaans', 'sportorientatie1', 'economieondernemen'),
  ('5548', '1a2', 'keramiek', 'fotografie', 'keuken'),
  ('5838', '1a1', 'tsi', 'virtualreality', 'economieondernemen'),
  ('5603', '1a1', 'spaans', 'fotografie', 'economieondernemen'),
  ('5614', '1a2', 'virtualreality', 'juniortechnovium', 'sportorientatie1'),
  ('5533', '1a1', 'spaans', 'film', 'economieondernemen'),
  ('5765', '1a2', 'keramiek', 'fotografie', 'uiterlijkeverzorging'),
  ('5753', '1a1', 'spaans', 'sportorientatie1', 'economieondernemen'),
  ('5663', '1a2', 'spaans', 'fotografie', 'film'),
  ('5679', '1a2', 'virtualreality', 'sportorientatie1', 'art'),
  ('5587', '1a2', 'virtualreality', 'juniortechnovium', 'keuken'),
  ('5568', '1a2', 'spaans', 'film', 'lerenindepraktijk'),
  ('5750', '1a1', 'spaans', 'lerenindepraktijk', 'economieondernemen'),
  ('5806', '1a1', 'virtualreality', 'film', 'economieondernemen'),
  ('5835', '1a1', 'sportorientatie1', 'fotografie', 'economieondernemen'),
  ('5836', '1a1', 'virtualreality', 'creatiefschrijven', 'economieondernemen'),
  ('5607', '1a2', 'virtualreality', 'art', 'keuken'),
  ('5559', '1a1', 'keramiek', 'tsi', 'economieondernemen'),
  ('5554', '1a2', 'sportorientatie2', 'tsi', 'sportorientatie1'),
  ('5746', '1a2', 'virtualreality', 'juniortechnovium', 'lerenindepraktijk'),
  ('5688', '1a1', 'tsi', 'sportorientatie1', 'economieondernemen');

-- 4) Leerlingen upserten
INSERT INTO students (student_number, first_name, last_name, class_name)
SELECT
  i.student_number,
  '',
  '',
  i.class_name
FROM import_1klas_talent i
ON CONFLICT (student_number) DO UPDATE
SET class_name = EXCLUDED.class_name;

-- 5) Historische assignments upserten (p1/p2/p3)
WITH period_lookup AS (
  SELECT period_number, id AS period_id
  FROM periods
  WHERE school_year = '2026-2027'
    AND year_level = 1
),
flat AS (
  SELECT student_number, 1 AS period_number, p1_code AS talent_code FROM import_1klas_talent
  UNION ALL
  SELECT student_number, 2 AS period_number, p2_code AS talent_code FROM import_1klas_talent
  UNION ALL
  SELECT student_number, 3 AS period_number, p3_code AS talent_code FROM import_1klas_talent
)
INSERT INTO assignments (student_id, period_id, assigned_talent_code, assigned_by)
SELECT
  s.id,
  p.period_id,
  f.talent_code,
  'csv-import-1klas'
FROM flat f
JOIN students s ON s.student_number = f.student_number
JOIN period_lookup p ON p.period_number = f.period_number
JOIN talents t ON t.code = f.talent_code
ON CONFLICT (student_id, period_id) DO UPDATE
SET assigned_talent_code = EXCLUDED.assigned_talent_code,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = NOW();

COMMIT;
