-- Talentuur import: leerlingen + historische gevolgde talenturen
-- Gebruik:
-- 1) Draai eerst sql/schema.sql (als dat nog niet is gebeurd)
-- 2) Draai daarna dit bestand
-- 3) Vul onderaan bij student_history_import jouw leerlingregels in

BEGIN;

-- 1) Extra talenturen (actueel + historisch) toevoegen/updaten
-- Mapping uit jouw bestand:
-- t_art  -> art
-- t_crea -> creatiefschrijven
-- t_eo   -> economieondernemen
-- t_film -> film
-- t_foto -> fotografie
-- t_ker  -> keramiek
-- t_keu  -> keuken
-- t_le   -> lerenindepraktijk
-- t_scl  -> science
-- t_sp1  -> sportorientatie1
-- t_sp2  -> sportorientatie2
-- t_spa  -> spaans
-- t_tech -> juniortechnovium
-- t_tal  -> tsi
-- t_uv   -> uiterlijkeverzorging
-- t_vr   -> virtualreality
-- t_zw   -> zorgwelzijn
INSERT INTO talents (code, label, allow_repeat, is_active, sort_order) VALUES
  ('economieondernemen', 'Economie en ondernemen', FALSE, TRUE, 13),
  ('zorgwelzijn', 'Zorg en welzijn', FALSE, TRUE, 14),
  ('keramiek', 'Keramiek', FALSE, TRUE, 15),
  ('science', 'Science', FALSE, FALSE, 16),
  ('spaans', 'Spaans', FALSE, FALSE, 17)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    allow_repeat = EXCLUDED.allow_repeat,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;

-- 2) Standaard 6 onderbouw-periodes maken voor historische import
-- Je kunt school_year aanpassen (nu: HISTORISCH)
INSERT INTO periods (name, school_year, year_level, period_number, is_open, available_talents)
SELECT p.name, 'HISTORISCH', p.year_level, p.period_number, FALSE, p.available_talents
FROM (
  VALUES
    ('Jaar 1 - Periode 1', 1, 1, ARRAY['art','keuken','sportorientatie1','sportorientatie2','fotografie','tsi','virtualreality','lerenindepraktijk','creatiefschrijven','uiterlijkeverzorging','juniortechnovium','film','keramiek','economieondernemen','zorgwelzijn']::TEXT[]),
    ('Jaar 1 - Periode 2', 1, 2, ARRAY['art','keuken','sportorientatie1','sportorientatie2','fotografie','tsi','virtualreality','lerenindepraktijk','creatiefschrijven','uiterlijkeverzorging','juniortechnovium','film','keramiek','economieondernemen','zorgwelzijn']::TEXT[]),
    ('Jaar 1 - Periode 3', 1, 3, ARRAY['art','keuken','sportorientatie1','sportorientatie2','fotografie','tsi','virtualreality','lerenindepraktijk','creatiefschrijven','uiterlijkeverzorging','juniortechnovium','film','keramiek','economieondernemen','zorgwelzijn']::TEXT[]),
    ('Jaar 2 - Periode 1', 2, 1, ARRAY['art','keuken','sportorientatie1','sportorientatie2','fotografie','tsi','virtualreality','lerenindepraktijk','creatiefschrijven','uiterlijkeverzorging','juniortechnovium','film','keramiek','economieondernemen','zorgwelzijn']::TEXT[]),
    ('Jaar 2 - Periode 2', 2, 2, ARRAY['art','keuken','sportorientatie1','sportorientatie2','fotografie','tsi','virtualreality','lerenindepraktijk','creatiefschrijven','uiterlijkeverzorging','juniortechnovium','film','keramiek','economieondernemen','zorgwelzijn']::TEXT[]),
    ('Jaar 2 - Periode 3', 2, 3, ARRAY['art','keuken','sportorientatie1','sportorientatie2','fotografie','tsi','virtualreality','lerenindepraktijk','creatiefschrijven','uiterlijkeverzorging','juniortechnovium','film','keramiek','economieondernemen','zorgwelzijn']::TEXT[])
) AS p(name, year_level, period_number, available_talents)
WHERE NOT EXISTS (
  SELECT 1
  FROM periods x
  WHERE x.school_year = 'HISTORISCH'
    AND x.year_level = p.year_level
    AND x.period_number = p.period_number
);

-- 3) Tijdelijke importtabel (leerlingnummer + klas + 6 gevolgde periodes)
DROP TABLE IF EXISTS student_history_import;
CREATE TEMP TABLE student_history_import (
  student_number TEXT NOT NULL,
  class_name TEXT NOT NULL,
  p1_code TEXT,
  p2_code TEXT,
  p3_code TEXT,
  p4_code TEXT,
  p5_code TEXT,
  p6_code TEXT
);

-- 4) PLAK HIER JE LEERLINGDATA
-- Vul per leerling de codes in (of NULL als onbekend/niet gevolgd)
-- Voorbeeld:
INSERT INTO student_history_import
  (student_number, class_name, p1_code, p2_code, p3_code, p4_code, p5_code, p6_code)
VALUES
  ('5825', '1a2', 'art', 'keuken', 'sportorientatie1', NULL, NULL, NULL)
  -- ,('5728', '1a2', 'tsi', 'virtualreality', 'fotografie', NULL, NULL, NULL)
;

-- 5) Leerlingen upserten
INSERT INTO students (student_number, first_name, last_name, class_name)
SELECT DISTINCT
  i.student_number,
  '',
  '',
  i.class_name
FROM student_history_import i
ON CONFLICT (student_number) DO UPDATE
SET class_name = EXCLUDED.class_name;

-- 6) Historische toewijzingen schrijven naar assignments
-- Periode-volgorde:
-- p1 -> Jaar 1 Periode 1
-- p2 -> Jaar 1 Periode 2
-- p3 -> Jaar 1 Periode 3
-- p4 -> Jaar 2 Periode 1
-- p5 -> Jaar 2 Periode 2
-- p6 -> Jaar 2 Periode 3
WITH period_lookup AS (
  SELECT
    year_level,
    period_number,
    id AS period_id
  FROM periods
  WHERE school_year = 'HISTORISCH'
),
flat AS (
  SELECT student_number, class_name, 1 AS year_level, 1 AS period_number, p1_code AS talent_code FROM student_history_import
  UNION ALL SELECT student_number, class_name, 1, 2, p2_code FROM student_history_import
  UNION ALL SELECT student_number, class_name, 1, 3, p3_code FROM student_history_import
  UNION ALL SELECT student_number, class_name, 2, 1, p4_code FROM student_history_import
  UNION ALL SELECT student_number, class_name, 2, 2, p5_code FROM student_history_import
  UNION ALL SELECT student_number, class_name, 2, 3, p6_code FROM student_history_import
)
INSERT INTO assignments (student_id, period_id, assigned_talent_code, assigned_by)
SELECT
  s.id,
  p.period_id,
  f.talent_code,
  'historische-import'
FROM flat f
JOIN students s ON s.student_number = f.student_number
JOIN period_lookup p
  ON p.year_level = f.year_level
 AND p.period_number = f.period_number
JOIN talents t ON t.code = f.talent_code
WHERE f.talent_code IS NOT NULL
ON CONFLICT (student_id, period_id) DO UPDATE
SET assigned_talent_code = EXCLUDED.assigned_talent_code,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = NOW();

COMMIT;
