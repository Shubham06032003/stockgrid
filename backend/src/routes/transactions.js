import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { calculateStock } from './products.js';
import { checkLowStockAlert } from '../services/alertService.js';

const router = express.Router();

// POST /api/transactions - Create a stock transaction (IN or OUT)
router.post('/', authenticate, requireRole('admin', 'manager', 'staff'), [
  body('product_id').isUUID().withMessage('Valid product ID required'),
  body('type').isIn(['IN', 'OUT']).withMessage('Type must be IN or OUT'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { product_id, type, quantity, reason, reference_no, notes, unit_cost } = req.body;
    const orgId = req.user.organization_id;

    // Verify product belongs to org
    console.log(`[DEBUG] Finding product ${product_id} for org ${orgId}`);
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, min_stock, organization_id, is_deleted')
      .eq('id', product_id)
      .eq('organization_id', orgId)
      .eq('is_deleted', false)
      .single();

    if (productError || !product) {
      console.error(`[Transaction Error] Product lookup failed for ID: ${product_id}. Error:`, productError);
      return res.status(404).json({ error: `Product with ID ${product_id} not found or doesn't belong to your organization.` });
    }

    console.log(`[Transaction] Product found: ${product.name} (Min Stock: ${product.min_stock})`);

    // For OUT transactions, verify sufficient stock
    if (type === 'OUT') {
      const currentStock = await calculateStock(product_id, orgId);
      if (currentStock < parseInt(quantity)) {
        return res.status(400).json({
          error: `Insufficient stock. Current: ${currentStock}, Requested: ${quantity}`
        });
      }
    }

    const txId = uuidv4();
    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        id: txId,
        product_id,
        organization_id: orgId,
        type,
        quantity: parseInt(quantity),
        reason,
        reference_no: reference_no || null,
        notes: notes || null,
        unit_cost: unit_cost ? parseFloat(unit_cost) : 0,
        created_by: req.user.id
      })
      .select(`*, product:products(id, name, sku, min_stock)`)
      .single();

    if (error) throw error;

    // Calculate new stock
    const newStock = await calculateStock(product_id, orgId);

    // Check if low stock alert should trigger
    await checkLowStockAlert(product_id, product.name, newStock, product.min_stock, orgId, req.user.id);

    res.status(201).json({ transaction, new_stock: newStock });
  } catch (err) {
    next(err);
  }
});

// GET /api/transactions
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      product_id,
      type,
      start_date,
      end_date,
      search = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const orgId = req.user.organization_id;

    let queryBuilder = supabase
      .from('transactions')
      .select(`
        *,
        product:products(id, name, sku, category),
        user:users(id, name, email)
      `, { count: 'exact' })
      .eq('organization_id', orgId);

    if (product_id) queryBuilder = queryBuilder.eq('product_id', product_id);
    if (type && ['IN', 'OUT'].includes(type)) queryBuilder = queryBuilder.eq('type', type);
    if (start_date) queryBuilder = queryBuilder.gte('created_at', start_date);
    if (end_date) queryBuilder = queryBuilder.lte('created_at', end_date + 'T23:59:59');

    const { data: transactions, error, count } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/transactions/summary
router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const { data, error } = await supabase
      .from('transactions')
      .select('type, quantity, created_at, product:products(name, category)')
      .eq('organization_id', orgId)
      .gte('created_at', since.toISOString());

    if (error) throw error;

    const totalIn = data.filter(t => t.type === 'IN').reduce((s, t) => s + t.quantity, 0);
    const totalOut = data.filter(t => t.type === 'OUT').reduce((s, t) => s + t.quantity, 0);

    res.json({ total_in: totalIn, total_out: totalOut, total_transactions: data.length });
  } catch (err) {
    next(err);
  }
});

export default router;
