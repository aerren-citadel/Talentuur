CREATE TABLE IF NOT EXISTS talents (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  allow_repeat BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS periods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  school_year TEXT NOT NULL,
  year_level INT NOT NULL CHECK (year_level IN (1, 2)),
  period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 3),
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  open_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ,
  available_talents TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  student_number TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS choices (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  period_id INT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  choice_rank INT NOT NULL CHECK (choice_rank BETWEEN 1 AND 4),
  talent_code TEXT NOT NULL REFERENCES talents(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, period_id, choice_rank)
);

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  period_id INT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  assigned_talent_code TEXT NOT NULL REFERENCES talents(code),
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, period_id)
);

INSERT INTO talents (code, label, allow_repeat, sort_order) VALUES
  ('art', 'Art', FALSE, 1),
  ('keuken', 'Keuken', FALSE, 2),
  ('sportorientatie1', 'Sportoriëntatie 1', TRUE, 3),
  ('sportorientatie2', 'Sportoriëntatie 2', TRUE, 4),
  ('fotografie', 'Fotografie', FALSE, 5),
  ('tsi', 'TSI', FALSE, 6),
  ('virtualreality', 'Virtual Reality', FALSE, 7),
  ('lerenindepraktijk', 'Leren in de praktijk', FALSE, 8),
  ('creatiefschrijven', 'Creatief schrijven', FALSE, 9),
  ('uiterlijkeverzorging', 'Uiterlijke verzorging', FALSE, 10),
  ('juniortechnovium', 'Junior Technovium', FALSE, 11),
  ('film', 'Film', FALSE, 12)
ON CONFLICT (code) DO NOTHING;
