const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/db');

// ── GET /api/dashboard/stats ───────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [tigers, sightings, gender, lastMonth] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as total,
                         SUM(CASE WHEN status='active'   THEN 1 ELSE 0 END)::int as active,
                         SUM(CASE WHEN status='inactive' THEN 1 ELSE 0 END)::int as inactive
                  FROM tigers WHERE status != 'deleted'`),
      pool.query(`SELECT COUNT(*)::int as total FROM sightings`),
      pool.query(`SELECT sex, COUNT(*)::int as count FROM tigers WHERE status != 'deleted' GROUP BY sex`),
      pool.query(`SELECT COUNT(*)::int as count FROM sightings
                  WHERE recorded_date >= NOW() - INTERVAL '30 days'`),
    ]);

    const genderMap = { M: 0, F: 0, U: 0 };
    gender.rows.forEach(r => { genderMap[r.sex] = r.count; });

    res.json({
      success: true,
      data: {
        tigers:          tigers.rows[0],
        sightings:       sightings.rows[0].total,
        sightingsLast30: lastMonth.rows[0].count,
        gender:          genderMap,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/dashboard/monthly ─────────────────────────
router.get('/monthly', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(recorded_date, 'YYYY-MM') AS month,
             COUNT(*)::int                     AS count
      FROM   sightings
      WHERE  recorded_date >= NOW() - INTERVAL '12 months'
      GROUP  BY month
      ORDER  BY month ASC
    `);

    // Fill missing months with 0
    const result = [];
    for (let i = 11; i >= 0; i--) {
      const d   = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0,7);
      const found = rows.find(r => r.month === key);
      const label = d.toLocaleDateString('id-ID', { month: 'short' }) + " '" + String(d.getFullYear()).slice(2);
      result.push({ month: key, label, count: found ? found.count : 0 });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/dashboard/recent ──────────────────────────
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || 8), 50);
    const { rows } = await pool.query(
      `SELECT s.*, t.name as tiger_name
       FROM sightings s LEFT JOIN tigers t ON t.id = s.tiger_id
       ORDER BY s.recorded_date DESC, s.recorded_time DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/dashboard/top-tigers ─────────────────────
router.get('/top-tigers', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.tiger_code, t.name, t.sex, t.status, 
              (SELECT COUNT(*)::int FROM sightings s WHERE s.tiger_id = t.id) AS sighting_count
       FROM tigers t
       WHERE t.status != 'deleted'
       ORDER BY sighting_count DESC LIMIT 5`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
