import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/alerts
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { resolved = 'false', limit = 50 } = req.query;
    const { data, error } = await supabase
      .from('alerts')
      .select('*, product:products(id, name, sku)')
      .eq('organization_id', req.user.organization_id)
      .eq('resolved', resolved === 'true')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;
    res.json({ alerts: data });
  } catch (err) { next(err); }
});

// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('organization_id', req.user.organization_id);

    if (error) throw error;
    res.json({ message: 'Alert resolved' });
  } catch (err) { next(err); }
});

export default router;
