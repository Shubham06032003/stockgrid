import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generateSKU } from '../utils/skuGenerator.js';

const router = express.Router();

// Helper: calculate current stock for a product
export async function calculateStock(productId, organizationId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, quantity')
    .eq('product_id', productId)
    .eq('organization_id', organizationId);

  if (error) throw error;

  return data.reduce((acc, tx) => {
    return tx.type === 'IN' ? acc + tx.quantity : acc - tx.quantity;
  }, 0);
}

// GET /api/products
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      supplier_id = '',
      stock_status = '',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const orgId = req.user.organization_id;

    let queryBuilder = supabase
      .from('products')
      .select(`
        *,
        supplier:suppliers(id, name),
        transactions(type, quantity, created_at)
      `, { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('is_deleted', false);

    if (search) {
      queryBuilder = queryBuilder.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }
    if (supplier_id) {
      queryBuilder = queryBuilder.eq('supplier_id', supplier_id);
    }

    const validSortFields = ['name', 'created_at', 'price', 'category', 'sku'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    queryBuilder = queryBuilder
      .order(sortField, { ascending: sort_order === 'asc' });

    const { data: products, error } = await queryBuilder;
    if (error) throw error;

    // Calculate current stock and 30d sales for each product
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const enriched = products.map(product => {
      let stock = 0;
      let sold_last_30_days = 0;
      (product.transactions || []).forEach(tx => {
        if (tx.type === 'IN') {
          stock += tx.quantity;
        } else {
          stock -= tx.quantity;
          if (new Date(tx.created_at) >= thirtyDaysAgo) {
            sold_last_30_days += tx.quantity;
          }
        }
      });

      const { transactions, ...rest } = product;
      const stockStatus = stock <= 0 ? 'out_of_stock' : stock <= product.min_stock ? 'low' : 'in_stock';

      return { ...rest, current_stock: stock, stock_status: stockStatus, sold_last_30_days };
    });

    // Filter by stock_status after calculation and sort in-stock first if no specific status
    let filtered = stock_status
      ? enriched.filter(p => p.stock_status === stock_status)
      : enriched;
      
    if (!stock_status && sort_by === 'created_at') {
      filtered = filtered.sort((a, b) => {
        const aInStock = a.current_stock > 0;
        const bInStock = b.current_stock > 0;
        if (aInStock && !bInStock) return -1;
        if (!aInStock && bInStock) return 1;
        // fallback to standard created_at sort if tie
        return sort_order === 'asc' 
          ? new Date(a.created_at) - new Date(b.created_at)
          : new Date(b.created_at) - new Date(a.created_at);
      });
    }

    const totalCount = filtered.length;
    const paginatedProducts = filtered.slice(offset, offset + parseInt(limit));

    res.json({
      products: paginatedProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select(`*, supplier:suppliers(id, name, contact_email, phone), transactions(*)`)
      .eq('id', req.params.id)
      .eq('organization_id', req.user.organization_id)
      .eq('is_deleted', false)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const stock = (product.transactions || []).reduce((acc, tx) => {
      return tx.type === 'IN' ? acc + tx.quantity : acc - tx.quantity;
    }, 0);

    res.json({
      ...product,
      current_stock: stock,
      stock_status: stock <= 0 ? 'out_of_stock' : stock <= product.min_stock ? 'low' : 'in_stock'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/products
router.post('/', authenticate, requireRole('admin', 'manager'), [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('min_stock').isInt({ min: 0 }).withMessage('Min stock must be a non-negative integer'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, sku, price, category, supplier_id, min_stock, description, unit, image_url, initial_stock } = req.body;

    // Auto-generate SKU if not provided
    const finalSku = sku || generateSKU(name, category);

    // Check SKU uniqueness within org
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('sku', finalSku)
      .eq('organization_id', req.user.organization_id)
      .eq('is_deleted', false)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'SKU already exists in your organization' });
    }

    const productId = uuidv4();
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        id: productId,
        name,
        sku: finalSku,
        price: parseFloat(price),
        category,
        supplier_id: supplier_id || null,
        min_stock: parseInt(min_stock),
        description: description || null,
        unit: unit || 'units',
        image_url: image_url || null,
        organization_id: req.user.organization_id,
        created_by: req.user.id,
        is_deleted: false
      })
      .select()
      .single();

    if (error) throw error;

    // Create initial stock transaction if provided
    if (initial_stock && parseInt(initial_stock) > 0) {
      await supabase.from('transactions').insert({
        id: uuidv4(),
        product_id: productId,
        organization_id: req.user.organization_id,
        type: 'IN',
        quantity: parseInt(initial_stock),
        reason: 'Initial stock',
        created_by: req.user.id
      });
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      id: uuidv4(),
      organization_id: req.user.organization_id,
      user_id: req.user.id,
      action: 'CREATE_PRODUCT',
      resource_type: 'product',
      resource_id: productId,
      metadata: { name, sku: finalSku }
    });

    res.status(201).json({ ...product, current_stock: parseInt(initial_stock) || 0 });
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id
router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { name, price, category, supplier_id, min_stock, description, unit, image_url } = req.body;

    const { data: product, error } = await supabase
      .from('products')
      .update({
        name, price: parseFloat(price), category, 
        supplier_id: supplier_id || null,
        min_stock: parseInt(min_stock), description, unit, image_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('organization_id', req.user.organization_id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) throw error;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Audit log
    await supabase.from('audit_logs').insert({
      id: uuidv4(),
      organization_id: req.user.organization_id,
      user_id: req.user.id,
      action: 'UPDATE_PRODUCT',
      resource_type: 'product',
      resource_id: req.params.id,
      metadata: { updated_fields: Object.keys(req.body) }
    });

    const stock = await calculateStock(req.params.id, req.user.organization_id);
    res.json({ ...product, current_stock: stock });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id (soft delete)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('products')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('organization_id', req.user.organization_id);

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      id: uuidv4(),
      organization_id: req.user.organization_id,
      user_id: req.user.id,
      action: 'DELETE_PRODUCT',
      resource_type: 'product',
      resource_id: req.params.id,
      metadata: {}
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/bulk-delete
router.post('/bulk-delete', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'List of product IDs required' });
    }

    const { error } = await supabase
      .from('products')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .in('id', ids)
      .eq('organization_id', req.user.organization_id);

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      id: uuidv4(),
      organization_id: req.user.organization_id,
      user_id: req.user.id,
      action: 'BULK_DELETE_PRODUCTS',
      resource_type: 'product',
      metadata: { deleted_count: ids.length, ids }
    });

    res.json({ message: `${ids.length} products deleted successfully` });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/meta/categories
router.get('/meta/categories', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('organization_id', req.user.organization_id)
      .eq('is_deleted', false);

    if (error) throw error;

    const categories = [...new Set(data.map(p => p.category))].filter(Boolean);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

export default router;
