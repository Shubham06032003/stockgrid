import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*, products:products(id, name, sku)')
      .eq('organization_id', req.user.organization_id)
      .eq('is_deleted', false)
      .order('name');

    if (error) throw error;
    res.json({ suppliers: data });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*, products:products(id, name, sku, category)')
      .eq('id', req.params.id)
      .eq('organization_id', req.user.organization_id)
      .eq('is_deleted', false)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Supplier not found' });
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('admin', 'manager'), [
  body('name').trim().notEmpty().withMessage('Supplier name required'),
  body('contact_email').optional().isEmail().withMessage('Valid email required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, contact_email, phone, address, notes, lead_time_days } = req.body;

    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        id: uuidv4(),
        name, contact_email: contact_email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        lead_time_days: lead_time_days ? parseInt(lead_time_days) : 7,
        organization_id: req.user.organization_id,
        is_deleted: false
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { name, contact_email, phone, address, notes, lead_time_days } = req.body;
    const { data, error } = await supabase
      .from('suppliers')
      .update({ name, contact_email, phone, address, notes, lead_time_days, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('organization_id', req.user.organization_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('suppliers')
      .update({ is_deleted: true })
      .eq('id', req.params.id)
      .eq('organization_id', req.user.organization_id);

    if (error) throw error;
    res.json({ message: 'Supplier deleted' });
  } catch (err) { next(err); }
});

router.post('/bulk-delete', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs required' });

    const { error } = await supabase
      .from('suppliers')
      .update({ is_deleted: true })
      .in('id', ids)
      .eq('organization_id', req.user.organization_id);

    if (error) throw error;
    res.json({ message: `${ids.length} suppliers deleted` });
  } catch (err) { next(err); }
});

export default router;
