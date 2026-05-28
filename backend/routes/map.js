const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/db');

// ── GET /api/map/points  (GeoJSON FeatureCollection) ──
router.get('/points', async (req, res) => {
  try {
    const { tiger_code, sex, date_from, date_to } = req.query;

    let   query  = `SELECT s.id, s.tiger_code, s.sex, s.stripe_side,
                           s.latitude, s.longitude, s.recorded_date, s.recorded_time,
                           s.notes, t.name as tiger_name
                    FROM sightings s LEFT JOIN tigers t ON t.id = s.tiger_id WHERE 1=1`;
    const params = [];

    if (tiger_code) { params.push(tiger_code); query += ` AND s.tiger_code = $${params.length}`; }
    if (sex)        { params.push(sex);         query += ` AND s.sex = $${params.length}`; }
    if (date_from)  { params.push(date_from);   query += ` AND s.recorded_date >= $${params.length}`; }
    if (date_to)    { params.push(date_to);     query += ` AND s.recorded_date <= $${params.length}`; }

    query += ' ORDER BY s.recorded_date DESC';
    const { rows } = await pool.query(query, params);

    const geojson = {
      type: 'FeatureCollection',
      features: rows.map(r => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(r.longitude), parseFloat(r.latitude)],
        },
        properties: {
          id:           r.id,
          tiger_code:   r.tiger_code,
          tiger_name:   r.tiger_name,
          sex:          r.sex,
          stripe_side:  r.stripe_side,
          recorded_date: r.recorded_date,
          recorded_time: r.recorded_time,
          notes:        r.notes,
        },
      })),
    };

    res.json({ success: true, data: geojson, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
