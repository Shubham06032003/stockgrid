import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import aiService from '../services/aiService.js';

const router = express.Router();

// POST /api/ai/chat
router.post('/chat', authenticate, async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    // Build context from recent dashboard data
    const orgId = req.user.organization_id;
    const { data: products } = await supabase
      .from('products')
      .select('name, category, transactions(type, quantity)')
      .eq('organization_id', orgId)
      .eq('is_deleted', false)
      .limit(50);

    const context = products ? `Organization has ${products.length} products.` : '';

    const response = await aiService.chat(messages, context);
    res.json({ response });
  } catch (err) {
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

// POST /api/ai/predict
router.post('/predict', authenticate, async (req, res, next) => {
  try {
    const { product_id } = req.body;
    const orgId = req.user.organization_id;

    const { data: product } = await supabase
      .from('products')
      .select('name')
      .eq('id', product_id)
      .eq('organization_id', orgId)
      .single();

    if (!product) return res.status(404).json({ error: `Product with ID ${product_id} not found or doesn't belong to your organization.` });

    // Get last 90 days of sales
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('quantity, created_at')
      .eq('product_id', product_id)
      .eq('organization_id', orgId)
      .eq('type', 'OUT')
      .gte('created_at', since.toISOString())
      .order('created_at');

    // Group by day
    const dailyMap = {};
    transactions?.forEach(tx => {
      const day = tx.created_at.split('T')[0];
      dailyMap[day] = (dailyMap[day] || 0) + tx.quantity;
    });

    const prediction = await aiService.predictDemand(
      Object.entries(dailyMap).map(([date, qty]) => ({ date, qty })),
      product.name
    );

    res.json(prediction);
  } catch (err) {
    if (err.message.includes('not configured')) return res.status(503).json({ error: err.message });
    next(err);
  }
});

// POST /api/ai/reorder-suggestions
router.post('/reorder-suggestions', authenticate, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;

    const { data: products } = await supabase
      .from('products')
      .select(`
        id, name, sku, min_stock, price, supplier_name,
        supplier:suppliers(name, lead_time_days),
        transactions(type, quantity, created_at)
      `)
      .eq('organization_id', orgId)
      .eq('is_deleted', false);

    if (!products) return res.status(404).json({ error: 'No products found' });

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const productsWithData = products.map(p => {
      const stock = (p.transactions || []).reduce((acc, tx) =>
        tx.type === 'IN' ? acc + tx.quantity : acc - tx.quantity, 0);

      const recentSales = (p.transactions || [])
        .filter(tx => tx.type === 'OUT' && new Date(tx.created_at) > since)
        .reduce((s, tx) => s + tx.quantity, 0);

      const avgDailySales = recentSales / 30;

      return {
        id: p.id, name: p.name, sku: p.sku,
        current_stock: stock, min_stock: p.min_stock,
        avg_daily_sales: Math.round(avgDailySales * 100) / 100,
        lead_time_days: p.supplier?.lead_time_days || 7,
        supplier_name: p.supplier?.name || p.supplier_name || 'Unknown'
      };
    }).filter(p => p.current_stock <= p.min_stock * 1.5);

    if (productsWithData.length === 0) {
      return res.json({ recommendations: [], summary: 'All products are well-stocked.' });
    }

    const suggestions = await aiService.suggestReorder(productsWithData);
    res.json(suggestions);
  } catch (err) {
    if (err.message.includes('not configured')) return res.status(503).json({ error: err.message });
    next(err);
  }
});

// POST /api/ai/dead-stock
router.post('/dead-stock', authenticate, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { days = 60 } = req.body;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, category, price, transactions(type, quantity, created_at)')
      .eq('organization_id', orgId)
      .eq('is_deleted', false);

    const deadStock = (products || []).filter(p => {
      const stock = (p.transactions || []).reduce((acc, tx) =>
        tx.type === 'IN' ? acc + tx.quantity : acc - tx.quantity, 0);
      if (stock <= 0) return false;
      return !(p.transactions || []).some(tx =>
        tx.type === 'OUT' && new Date(tx.created_at) > since);
    }).map(p => {
      const stock = (p.transactions || []).reduce((acc, tx) =>
        tx.type === 'IN' ? acc + tx.quantity : acc - tx.quantity, 0);
      return { id: p.id, name: p.name, sku: p.sku, category: p.category, current_stock: stock, value: Math.round(stock * p.price * 100) / 100 };
    });

    if (deadStock.length === 0) {
      return res.json({ recommendations: [], summary: 'No dead stock detected. All products have recent sales activity.', total_dead_stock_value: 0 });
    }

    const analysis = await aiService.analyzeDeadStock(deadStock);
    res.json(analysis);
  } catch (err) {
    if (err.message.includes('not configured')) return res.status(503).json({ error: err.message });
    next(err);
  }
});

// POST /api/ai/column-map
router.post('/column-map', authenticate, async (req, res, next) => {
  try {
    const { headers, sample_data } = req.body;
    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({ error: 'Headers array required' });
    }

    const mapping = await aiService.mapCSVColumns(headers, sample_data || []);
    res.json({ mapping });
  } catch (err) {
    if (err.message.includes('not configured')) return res.status(503).json({ error: err.message });
    next(err);
  }
});

// POST /api/ai/generate-sku
router.post('/generate-sku', authenticate, async (req, res, next) => {
  try {
    const { name, category } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name required' });

    const sku = await aiService.generateSKU(name, category);
    res.json({ sku });
  } catch (err) {
    if (err.message.includes('not configured')) return res.status(503).json({ error: err.message });
    next(err);
  }
});

// POST /api/ai/dashboard-insights
router.post('/dashboard-insights', authenticate, async (req, res, next) => {
  try {
    const { dashboard_data } = req.body;
    if (!dashboard_data) return res.status(400).json({ error: 'Dashboard data required' });

    const insights = await aiService.generateDashboardInsights(dashboard_data);
    res.json(insights);
  } catch (err) {
    if (err.message.includes('not configured')) return res.status(503).json({ error: err.message });
    next(err);
  }
});

export default router;
