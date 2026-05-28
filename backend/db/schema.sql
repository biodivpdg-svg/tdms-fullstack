-- ════════════════════════════════════════════════════════════
--  TDMS — Tiger Database Management System
--  Schema + Seed Data
-- ════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tigers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tigers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tiger_code       VARCHAR(50) UNIQUE NOT NULL,
  name             VARCHAR(100),
  sex              CHAR(1)     CHECK (sex IN ('M','F','U')) DEFAULT 'U',
  status           VARCHAR(20) DEFAULT 'active',
  stripe_left_url  TEXT,
  stripe_right_url TEXT,
  first_recorded_at DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sightings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sightings (
  id               SERIAL      PRIMARY KEY,
  tiger_id         UUID        REFERENCES tigers(id) ON DELETE SET NULL,
  tiger_code       VARCHAR(50) NOT NULL,
  sex              CHAR(1)     CHECK (sex IN ('M','F','U')) DEFAULT 'U',
  latitude         DECIMAL(10,7) NOT NULL,
  longitude        DECIMAL(10,7) NOT NULL,
  stripe_side      VARCHAR(10) CHECK (stripe_side IN ('left','right','both')),
  has_stripe_left  BOOLEAN     DEFAULT FALSE,
  has_stripe_right BOOLEAN     DEFAULT FALSE,
  stripe_left_url  TEXT,
  stripe_right_url TEXT,
  recorded_date    DATE        NOT NULL,
  recorded_time    TIME        NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Attachments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id            SERIAL      PRIMARY KEY,
  sighting_id   INTEGER     REFERENCES sightings(id) ON DELETE CASCADE,
  side          VARCHAR(10) CHECK (side IN ('left','right','other')),
  file_url      TEXT        NOT NULL,
  file_type     VARCHAR(50),
  file_size     BIGINT,
  original_name TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sightings_tiger_code   ON sightings(tiger_code);
CREATE INDEX IF NOT EXISTS idx_sightings_tiger_id     ON sightings(tiger_id);
CREATE INDEX IF NOT EXISTS idx_sightings_recorded_date ON sightings(recorded_date);
CREATE INDEX IF NOT EXISTS idx_attachments_sighting   ON attachments(sighting_id);

-- ════════════════════════════════════════════════════════════
--  SEED DATA
-- ════════════════════════════════════════════════════════════

INSERT INTO tigers (tiger_code, name, sex, status, first_recorded_at, notes) VALUES
  ('TGR-001', 'Ratu',   'F', 'active',   '2024-01-15', 'Betina dewasa, teritori zona A Bukit Tigapuluh. Diketahui memiliki dua anak.'),
  ('TGR-002', 'Gagah',  'M', 'active',   '2024-02-20', 'Jantan dominan, teritori luas zona A-B. Sering memarkahi batas kawasan.'),
  ('TGR-003', NULL,     'U', 'active',   '2024-03-10', 'Jenis kelamin belum terkonfirmasi, kualitas foto rekaman masih rendah.'),
  ('TGR-004', 'Siti',   'F', 'active',   '2024-04-05', 'Anak betina dari TGR-001 (Ratu), mulai menunjukkan perilaku mandiri.'),
  ('TGR-005', 'Raja',   'M', 'active',   '2024-05-18', 'Jantan dewasa zona Tesso Nilo, teritori di bagian utara kawasan.'),
  ('TGR-006', 'Bima',   'M', 'inactive', '2024-06-22', 'Terakhir terekam September 2024. Perlu investigasi lapangan lanjutan.'),
  ('TGR-007', 'Putri',  'F', 'active',   '2024-07-30', 'Betina zona Way Kambas, dua anak terdeteksi pada survei 2024.'),
  ('TGR-008', NULL,     'U', 'active',   '2024-08-15', 'Data sangat terbatas, hanya satu penampakan singkat.')
ON CONFLICT (tiger_code) DO NOTHING;

-- Sightings seed (insert using tiger_code cross-join to get id)
DO $$
DECLARE
  v_id UUID;
BEGIN
  -- Prevent duplicate seeding if sightings already exist
  IF EXISTS (SELECT 1 FROM sightings LIMIT 1) THEN
    RETURN;
  END IF;

  -- TGR-001 Ratu
  SELECT id INTO v_id FROM tigers WHERE tiger_code='TGR-001';
  INSERT INTO sightings (tiger_id,tiger_code,sex,latitude,longitude,stripe_side,has_stripe_left,has_stripe_right,recorded_date,recorded_time,notes) VALUES
    (v_id,'TGR-001','F',-0.4200000,102.5800000,'both',true, true, '2024-01-15','06:23','Pertama kali terdeteksi kamera trap zona A'),
    (v_id,'TGR-001','F',-0.4100000,102.6200000,'left',true, false,'2024-03-22','19:45','Membawa anak usia sekitar 6 bulan'),
    (v_id,'TGR-001','F',-0.4500000,102.5500000,'right',false,true, '2024-06-10','05:12',''),
    (v_id,'TGR-001','F',-0.3800000,102.6000000,'both',true, true, '2024-09-05','20:30','Di dekat sungai kecil, minum air'),
    (v_id,'TGR-001','F',-0.4000000,102.5700000,'left',true, false,'2025-01-18','06:55',''),
    (v_id,'TGR-001','F',-0.4300000,102.6100000,'both',true, true, '2025-05-02','07:15','Foto resolusi sangat tinggi, kualitas terbaik')
  ON CONFLICT DO NOTHING;

  -- TGR-002 Gagah
  SELECT id INTO v_id FROM tigers WHERE tiger_code='TGR-002';
  INSERT INTO sightings (tiger_id,tiger_code,sex,latitude,longitude,stripe_side,has_stripe_left,has_stripe_right,recorded_date,recorded_time,notes) VALUES
    (v_id,'TGR-002','M',-0.5000000,102.7000000,'right',false,true, '2024-02-20','21:10','Jantan berbadan besar, perkiraan BB 140 kg'),
    (v_id,'TGR-002','M',-0.5500000,102.6800000,'both',true, true, '2024-04-15','04:30',''),
    (v_id,'TGR-002','M',-0.5200000,102.7200000,'left',true, false,'2024-07-28','18:45',''),
    (v_id,'TGR-002','M',-0.4800000,102.6500000,'right',false,true, '2024-11-12','05:20','Markah teritori baru ditemukan di sekitar area'),
    (v_id,'TGR-002','M',-0.5300000,102.7100000,'both',true, true, '2025-03-08','07:00','')
  ON CONFLICT DO NOTHING;

  -- TGR-003
  SELECT id INTO v_id FROM tigers WHERE tiger_code='TGR-003';
  INSERT INTO sightings (tiger_id,tiger_code,sex,latitude,longitude,stripe_side,has_stripe_left,has_stripe_right,recorded_date,recorded_time,notes) VALUES
    (v_id,'TGR-003','U',-2.1500000,101.5200000,'left',true, false,'2024-03-10','03:45','Foto kurang jelas akibat kamera trap berembun'),
    (v_id,'TGR-003','U',-2.1200000,101.4800000,'right',false,true, '2024-08-22','19:00','')
  ON CONFLICT DO NOTHING;

  -- TGR-004 Siti
  SELECT id INTO v_id FROM tigers WHERE tiger_code='TGR-004';
  INSERT INTO sightings (tiger_id,tiger_code,sex,latitude,longitude,stripe_side,has_stripe_left,has_stripe_right,recorded_date,recorded_time,notes) VALUES
    (v_id,'TGR-004','F',-0.4400000,102.5900000,'both',true, true, '2024-04-05','06:10','Anak Ratu, berusia sekitar 1 tahun'),
    (v_id,'TGR-004','F',-0.4600000,102.5600000,'left',true, false,'2024-10-14','07:30',''),
    (v_id,'TGR-004','F',-0.4200000,102.6300000,'both',true, true, '2025-02-28','18:50','Mulai menunjukkan perilaku mandiri')
  ON CONFLICT DO NOTHING;

  -- TGR-005 Raja
  SELECT id INTO v_id FROM tigers WHERE tiger_code='TGR-005';
  INSERT INTO sightings (tiger_id,tiger_code,sex,latitude,longitude,stripe_side,has_stripe_left,has_stripe_right,recorded_date,recorded_time,notes) VALUES
    (v_id,'TGR-005','M', 0.1200000,102.3200000,'right',false,true, '2024-05-18','04:00','Area Tesso Nilo, bagian utara'),
    (v_id,'TGR-005','M', 0.1000000,102.2800000,'both',true, true, '2024-08-03','20:15',''),
    (v_id,'TGR-005','M', 0.1500000,102.3500000,'left',true, false,'2024-12-20','05:45',''),
    (v_id,'TGR-005','M', 0.0800000,102.3000000,'right',false,true, '2025-04-10','06:20','Bekas cakaran ditemukan di pohon sekitar area')
  ON CONFLICT DO NOTHING;

  -- TGR-006 Bima
  SELECT id INTO v_id FROM tigers WHERE tiger_code='TGR-006';
  INSERT INTO sightings (tiger_id,tiger_code,sex,latitude,longitude,stripe_side,has_stripe_left,has_stripe_right,recorded_date,recorded_time,notes) VALUES
    (v_id,'TGR-006','M', 3.8200000, 97.4500000,'both',true, true, '2024-06-22','03:30','Area TNGL (Taman Nasional Gunung Leuser)'),
    (v_id,'TGR-006','M', 3.7800000, 97.4200000,'left',true, false,'2024-09-30','19:10','Rekaman terakhir yang berhasil dikonfirmasi')
  ON CONFLICT DO NOTHING;

  -- TGR-007 Putri
  SELECT id INTO v_id FROM tigers WHERE tiger_code='TGR-007';
  INSERT INTO sightings (tiger_id,tiger_code,sex,latitude,longitude,stripe_side,has_stripe_left,has_stripe_right,recorded_date,recorded_time,notes) VALUES
    (v_id,'TGR-007','F',-4.7200000,105.6800000,'both',true, true, '2024-07-30','06:00','Way Kambas, terlihat bersama dua anaknya'),
    (v_id,'TGR-007','F',-4.7500000,105.7200000,'right',false,true, '2024-11-05','20:30',''),
    (v_id,'TGR-007','F',-4.7000000,105.6500000,'left',true, false,'2025-04-22','05:40','Anak sudah mencapai 3/4 ukuran induk')
  ON CONFLICT DO NOTHING;

  -- TGR-008
  SELECT id INTO v_id FROM tigers WHERE tiger_code='TGR-008';
  INSERT INTO sightings (tiger_id,tiger_code,sex,latitude,longitude,stripe_side,has_stripe_left,has_stripe_right,recorded_date,recorded_time,notes) VALUES
    (v_id,'TGR-008','U',-0.5000000,102.4800000,'left',true, false,'2024-08-15','03:15','Penampakan sangat singkat, data terbatas')
  ON CONFLICT DO NOTHING;
END $$;
