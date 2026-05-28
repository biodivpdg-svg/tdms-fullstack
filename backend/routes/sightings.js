const express = require('express');
const router  = express.Router();
const { pool } = require('../config/db');
const upload   = require('../middleware/upload');

const SIGHTING_FIELDS = [
  { name: 'stripe_left',   maxCount: 1 },
  { name: 'stripe_right',  maxCount: 1 },
  { name: 'attach_left',   maxCount: 10 },
  { name: 'attach_right',  maxCount: 10 },
];

// ── GET /api/sightings ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, sex, tiger_code, stripe_side, date_from, date_to, page = 1, per = 50, sort = 'recorded_date', order = 'desc' } = req.query;

    const allowedSort  = ['id','tiger_code','sex','latitude','longitude','stripe_side','recorded_date','recorded_time'];
    const allowedOrder = ['asc','desc'];
    const safeSort  = allowedSort.includes(sort)  ? sort  : 'recorded_date';
    const safeOrder = allowedOrder.includes(order) ? order : 'desc';

    let   query  = `SELECT s.*, COALESCE(json_agg(a.*) FILTER (WHERE a.id IS NOT NULL),'[]') AS attachments
                    FROM sightings s LEFT JOIN attachments a ON a.sighting_id = s.id WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (s.tiger_code ILIKE $${params.length} OR s.notes ILIKE $${params.length})`;
    }
    if (sex)         { params.push(sex);         query += ` AND s.sex = $${params.length}`; }
    if (tiger_code)  { params.push(tiger_code);  query += ` AND s.tiger_code = $${params.length}`; }
    if (stripe_side) { params.push(stripe_side); query += ` AND s.stripe_side = $${params.length}`; }
    if (date_from)   { params.push(date_from);   query += ` AND s.recorded_date >= $${params.length}`; }
    if (date_to)     { params.push(date_to);     query += ` AND s.recorded_date <= $${params.length}`; }

    query += ` GROUP BY s.id ORDER BY s.${safeSort} ${safeOrder}`;

    // Count total (without pagination)
    const countQ  = query.replace(/SELECT s\.\*, COALESCE.*?FROM/, 'SELECT COUNT(*) FROM').replace(/GROUP BY.*$/s, '');
    const { rows: cRows } = await pool.query(countQ, params);
    const total = parseInt(cRows[0]?.count || 0);

    // Paginate
    const offset = (parseInt(page) - 1) * parseInt(per);
    params.push(parseInt(per)); query += ` LIMIT $${params.length}`;
    params.push(offset);       query += ` OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows, total, page: parseInt(page), per: parseInt(per), pages: Math.ceil(total / parseInt(per)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/sightings/:id ─────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, COALESCE(json_agg(a.*) FILTER (WHERE a.id IS NOT NULL),'[]') AS attachments
       FROM sightings s LEFT JOIN attachments a ON a.sighting_id = s.id
       WHERE s.id = $1 GROUP BY s.id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Sighting not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/sightings ────────────────────────────────
router.post('/', upload.fields(SIGHTING_FIELDS), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      tiger_code, sex, latitude, longitude,
      stripe_side, recorded_date, recorded_time, notes,
    } = req.body;

    // Validate required
    if (!tiger_code || !latitude || !longitude || !recorded_date || !recorded_time)
      return res.status(400).json({ success: false, error: 'Missing required fields: tiger_code, latitude, longitude, recorded_date, recorded_time' });

    // Resolve tiger_id from tiger_code
    const tRes = await client.query('SELECT id FROM tigers WHERE tiger_code = $1', [tiger_code]);
    const tiger_id = tRes.rows[0]?.id || null;

    // Stripe photo URLs
    const stripeL = req.files?.stripe_left?.[0]  ? `/uploads/${req.files.stripe_left[0].filename}`  : null;
    const stripeR = req.files?.stripe_right?.[0] ? `/uploads/${req.files.stripe_right[0].filename}` : null;
    const hasL    = !!stripeL || stripe_side === 'left'  || stripe_side === 'both';
    const hasR    = !!stripeR || stripe_side === 'right' || stripe_side === 'both';

    const { rows } = await client.query(
      `INSERT INTO sightings
         (tiger_id, tiger_code, sex, latitude, longitude, stripe_side,
          has_stripe_left, has_stripe_right, stripe_left_url, stripe_right_url,
          recorded_date, recorded_time, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [tiger_id, tiger_code, sex || 'U', parseFloat(latitude), parseFloat(longitude),
       stripe_side || 'both', hasL, hasR, stripeL, stripeR,
       recorded_date, recorded_time, notes || '']
    );
    const sighting = rows[0];

    // Attachments
    const attRows = [];
    for (const f of (req.files?.attach_left  || [])) {
      const { rows: ar } = await client.query(
        `INSERT INTO attachments (sighting_id, side, file_url, file_type, file_size, original_name)
         VALUES ($1,'left',$2,$3,$4,$5) RETURNING *`,
        [sighting.id, `/uploads/${f.filename}`, f.mimetype, f.size, f.originalname]
      );
      attRows.push(ar[0]);
    }
    for (const f of (req.files?.attach_right || [])) {
      const { rows: ar } = await client.query(
        `INSERT INTO attachments (sighting_id, side, file_url, file_type, file_size, original_name)
         VALUES ($1,'right',$2,$3,$4,$5) RETURNING *`,
        [sighting.id, `/uploads/${f.filename}`, f.mimetype, f.size, f.originalname]
      );
      attRows.push(ar[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { ...sighting, attachments: attRows } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ── PATCH /api/sightings/:id ───────────────────────────
router.patch('/:id', upload.fields(SIGHTING_FIELDS), async (req, res) => {
  try {
    const sets   = ['updated_at = NOW()'];
    const params = [];
    const add    = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    const { tiger_code, sex, latitude, longitude, stripe_side, recorded_date, recorded_time, notes } = req.body;
    if (tiger_code)     add('tiger_code',    tiger_code);
    if (sex)            add('sex',           sex);
    if (latitude)       add('latitude',      parseFloat(latitude));
    if (longitude)      add('longitude',     parseFloat(longitude));
    if (stripe_side)    add('stripe_side',   stripe_side);
    if (recorded_date)  add('recorded_date', recorded_date);
    if (recorded_time)  add('recorded_time', recorded_time);
    if (notes !== undefined) add('notes',    notes);
    if (req.files?.stripe_left?.[0])  add('stripe_left_url',  `/uploads/${req.files.stripe_left[0].filename}`);
    if (req.files?.stripe_right?.[0]) add('stripe_right_url', `/uploads/${req.files.stripe_right[0].filename}`);

    // Recalculate has_stripe_*
    if (stripe_side) {
      add('has_stripe_left',  stripe_side === 'left'  || stripe_side === 'both');
      add('has_stripe_right', stripe_side === 'right' || stripe_side === 'both');
    }

    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE sightings SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Sighting not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/sightings/:id ──────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM sightings WHERE id = $1 RETURNING id', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Sighting not found' });
    res.json({ success: true, message: `Sighting ${rows[0].id} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/sightings/:id/attachments/:attId ───────
router.delete('/:id/attachments/:attId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM attachments WHERE id = $1 AND sighting_id = $2 RETURNING id',
      [req.params.attId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Attachment not found' });
    res.json({ success: true, message: 'Attachment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/sightings/export/csv ─────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.tiger_code, t.name as tiger_name,
              CASE s.sex WHEN 'M' THEN 'Jantan' WHEN 'F' THEN 'Betina' ELSE 'Tidak Diketahui' END as jenis_kelamin,
              s.latitude, s.longitude,
              CASE s.stripe_side WHEN 'both' THEN 'Keduanya' WHEN 'left' THEN 'Kiri' ELSE 'Kanan' END as belang,
              s.recorded_date, s.recorded_time,
              CASE WHEN s.has_stripe_left  THEN 'Ya' ELSE 'Tidak' END as foto_kiri,
              CASE WHEN s.has_stripe_right THEN 'Ya' ELSE 'Tidak' END as foto_kanan,
              s.notes
       FROM sightings s LEFT JOIN tigers t ON t.id = s.tiger_id
       ORDER BY s.recorded_date DESC, s.recorded_time DESC`
    );

    const headers = ['No','ID Harimau','Nama','Jenis Kelamin','Latitude','Longitude','Belang','Tanggal','Waktu','Foto Kiri','Foto Kanan','Catatan'];
    const csv = [
      '\uFEFF' + headers.join(','),
      ...rows.map((r, i) => [
        i+1, r.tiger_code, r.tiger_name||'', r.jenis_kelamin,
        r.latitude, r.longitude, r.belang,
        r.recorded_date, r.recorded_time,
        r.foto_kiri, r.foto_kanan,
        `"${(r.notes||'').replace(/"/g,'""')}"`
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tdms_rekaman_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
