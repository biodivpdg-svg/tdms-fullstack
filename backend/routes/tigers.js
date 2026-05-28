const express = require('express');
const router  = express.Router();
const { pool } = require('../config/db');
const upload   = require('../middleware/upload');

// ── GET /api/tigers ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, sex, status } = req.query;
    let   query  = `
      SELECT t.*,
             (SELECT COUNT(*)::int FROM sightings s WHERE s.tiger_id = t.id) AS sighting_count,
             (SELECT MAX(s.recorded_date) FROM sightings s WHERE s.tiger_id = t.id) AS last_sighting
      FROM   tigers t
      WHERE  t.status != 'deleted'
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (t.tiger_code ILIKE $${params.length} OR t.name ILIKE $${params.length})`;
    }
    if (sex) {
      params.push(sex);
      query += ` AND t.sex = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    query += ' ORDER BY t.tiger_code ASC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/tigers/:code ──────────────────────────────
router.get('/:code', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, 
              (SELECT COUNT(*)::int FROM sightings s WHERE s.tiger_id = t.id) AS sighting_count,
              (SELECT MAX(s.recorded_date) FROM sightings s WHERE s.tiger_id = t.id) AS last_sighting
       FROM   tigers t
       WHERE  t.tiger_code = $1 AND t.status != 'deleted'`,
      [req.params.code]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Tiger not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/tigers/:code/sightings ───────────────────
router.get('/:code/sightings', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, 
              COALESCE((SELECT json_agg(a.*) FROM attachments a WHERE a.sighting_id = s.id), '[]') AS attachments
       FROM   sightings s
       WHERE  s.tiger_code = $1
       ORDER  BY s.recorded_date DESC, s.recorded_time DESC`,
      [req.params.code]
    );
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/tigers ───────────────────────────────────
router.post('/', upload.fields([
  { name: 'stripe_left',  maxCount: 1 },
  { name: 'stripe_right', maxCount: 1 },
]), async (req, res) => {
  try {
    const { tiger_code, name, sex, status, notes, first_recorded_at } = req.body;

    if (!tiger_code) return res.status(400).json({ success: false, error: 'tiger_code is required' });

    const stripeL = req.files?.stripe_left?.[0]  ? `/uploads/${req.files.stripe_left[0].filename}`  : null;
    const stripeR = req.files?.stripe_right?.[0] ? `/uploads/${req.files.stripe_right[0].filename}` : null;

    const { rows } = await pool.query(
      `INSERT INTO tigers (tiger_code, name, sex, status, notes, first_recorded_at, stripe_left_url, stripe_right_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tiger_code, name || null, sex || 'U', status || 'active', notes || null, first_recorded_at || null, stripeL, stripeR]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Tiger code already exists' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/tigers/:code ────────────────────────────
router.patch('/:code', upload.fields([
  { name: 'stripe_left',  maxCount: 1 },
  { name: 'stripe_right', maxCount: 1 },
]), async (req, res) => {
  try {
    const sets   = ['updated_at = NOW()'];
    const params = [];

    const add = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if (req.body.name  !== undefined) add('name',   req.body.name || null);
    if (req.body.sex)                 add('sex',    req.body.sex);
    if (req.body.status)              add('status', req.body.status);
    if (req.body.notes !== undefined) add('notes',  req.body.notes || null);
    if (req.files?.stripe_left?.[0])  add('stripe_left_url',  `/uploads/${req.files.stripe_left[0].filename}`);
    if (req.files?.stripe_right?.[0]) add('stripe_right_url', `/uploads/${req.files.stripe_right[0].filename}`);

    params.push(req.params.code);
    const { rows } = await pool.query(
      `UPDATE tigers SET ${sets.join(', ')} WHERE tiger_code = $${params.length} AND status != 'deleted' RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Tiger not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/tigers/:code (soft delete) ─────────────
router.delete('/:code', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tigers SET status = 'deleted', updated_at = NOW() WHERE tiger_code = $1 RETURNING tiger_code`,
      [req.params.code]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Tiger not found' });
    res.json({ success: true, message: `Tiger ${rows[0].tiger_code} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
