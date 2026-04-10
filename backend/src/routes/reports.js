import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reports/dashboard - KPIs for dashboard
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;

    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_deleted', false);

    if (pErr) throw pErr;

    // Get all transactions for these products to compute current stock
    const { data: allTx, error: allTxErr } = await supabase
      .from('transactions')
      .select('product_id, type, quantity')
      .eq('organization_id', orgId);

    if (allTxErr) throw allTxErr;

    // Build a stock map
    const stockMap = {};
    (allTx || []).forEach(tx => {
      if (!stockMap[tx.product_id]) stockMap[tx.product_id] = 0;
      if (tx.type === 'IN') stockMap[tx.product_id] += tx.quantity;
      else stockMap[tx.product_id] -= tx.quantity;
    });

    let totalValue = 0;
    let outOfStock = 0;
    let lowStock = 0;

    const enriched = (products || []).map(p => {
      const stock = stockMap[p.id] || 0;
      const val = stock * (p.price || 0);
      totalValue += val;
      if (stock <= 0) outOfStock++;
      else if (stock <= (p.min_stock || 0)) lowStock++;
      return { ...p, current_stock: stock };
    });

    // Get transactions in last 30 days for trends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentTx, error: txErr } = await supabase
      .from('transactions')
      .select('id, type, quantity, created_at, unit_cost, product_id, product:products(name, category, price)')
      .eq('organization_id', orgId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (txErr) {
      console.error('Error fetching recent transactions:', txErr);
      throw txErr;
    }

    // Map product data from our local products array for extra safety
    const productMap = {};
    (products || []).forEach(p => productMap[p.id] = p);

    const recentTxEnriched = (recentTx || []).map(tx => {
      const p = productMap[tx.product_id] || tx.product || {};
      return {
        ...tx,
        product: {
          ...tx.product,
          ...p
        }
      };
    });

    if (!recentTx) {
      console.error('No recent transactions data returned from Supabase');
      throw new Error('Database returned empty transaction set');
    }

    const totalSalesQty = recentTx.filter(t => t.type === 'OUT').reduce((s, t) => s + t.quantity, 0);
    const totalRestockQty = recentTx.filter(t => t.type === 'IN').reduce((s, t) => s + t.quantity, 0);

    const salesByDay = {};
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      last7Days.push(key);
      salesByDay[key] = { date: key, in: 0, out: 0, revenue: 0, profit: 0 };
    }

    let thisMonthRevenue = 0;
    let thisMonthCost = 0;

    recentTxEnriched.forEach(tx => {
      const day = tx.created_at.split('T')[0];
      if (tx.type === 'OUT') {
        const qty = tx.quantity;
        const price = tx.product?.price || 0;
        // cost_price column is missing in DB; fallback to unit_cost from transaction or 0
        const costPrice = tx.unit_cost || 0;

        thisMonthRevenue += (qty * price);
        thisMonthCost += (qty * costPrice);

        if (salesByDay[day]) {
          salesByDay[day].out += qty;
          salesByDay[day].revenue = (salesByDay[day].revenue || 0) + (qty * price);
          salesByDay[day].profit = (salesByDay[day].profit || 0) + (qty * (price - costPrice));
        }
      } else if (tx.type === 'IN') {
        if (salesByDay[day]) {
          salesByDay[day].in += tx.quantity;
        }
      }
    });

    const thisMonthProfit = thisMonthRevenue - thisMonthCost;

    // Category distribution
    const categoryMap = {};
    enriched.forEach(p => {
      const cat = p.category || 'Uncategorized';
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, value: 0 };
      categoryMap[cat].count++;
      categoryMap[cat].value += p.current_stock * p.price;
    });

    res.json({
      kpis: {
        total_skus: products.length,
        total_stock_value: Math.round(totalValue * 100) / 100,
        out_of_stock: outOfStock,
        low_stock: lowStock,
        sales_last_30d: totalSalesQty,
        restock_last_30d: totalRestockQty,
        profit_last_30d: Math.round(thisMonthProfit * 100) / 100
      },
      sales_trend: Object.values(salesByDay),
      category_distribution: Object.entries(categoryMap).map(([name, data]) => ({
        name, ...data
      })),
      recent_transactions: recentTxEnriched.slice(0, 10)
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/inventory-valuation
router.get('/inventory-valuation', authenticate, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;

    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_deleted', false);

    if (pErr) throw pErr;

    const { data: allTx, error: allTxErr } = await supabase
      .from('transactions')
      .select('product_id, type, quantity')
      .eq('organization_id', orgId);

    if (allTxErr) throw allTxErr;

    const stockMap = {};
    const soldMap = {};
    (allTx || []).forEach(tx => {
      if (!stockMap[tx.product_id]) { stockMap[tx.product_id] = 0; soldMap[tx.product_id] = 0; }
      if (tx.type === 'IN') stockMap[tx.product_id] += tx.quantity;
      else {
        stockMap[tx.product_id] -= tx.quantity;
        soldMap[tx.product_id] += tx.quantity;
      }
    });

    const valuation = (products || []).map(p => {
      const stock = stockMap[p.id] || 0;
      const total_sold = soldMap[p.id] || 0;
      // cost_price missing in DB, default to 0
      const cost_price = p.cost_price || 0;
      const profit_per_unit = (p.price || 0) - cost_price;
      const margin_pct = (p.price || 0) > 0 ? (profit_per_unit / p.price) * 100 : 0;
      const total_profit = profit_per_unit * total_sold;

      return {
        id: p.id, name: p.name, sku: p.sku, category: p.category,
        unit_price: p.price, cost_price, current_stock: stock,
        total_value: Math.round(stock * p.price * 100) / 100,
        profit_per_unit, margin_pct: Math.round(margin_pct * 10) / 10, total_profit,
        status: stock <= 0 ? 'out_of_stock' : stock <= p.min_stock ? 'low' : 'in_stock'
      };
    });

    const totalValue = valuation.reduce((s, p) => s + p.total_value, 0);

    res.json({ valuation, total_value: Math.round(totalValue * 100) / 100 });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/top-products
router.get('/top-products', authenticate, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const { data, error } = await supabase
      .from('transactions')
      .select('product_id, quantity, product:products(name, sku, category)')
      .eq('organization_id', orgId)
      .eq('type', 'OUT')
      .gte('created_at', since.toISOString());

    if (error) throw error;

    const productMap = {};
    data.forEach(tx => {
      if (!productMap[tx.product_id]) {
        productMap[tx.product_id] = {
          product_id: tx.product_id,
          name: tx.product?.name,
          sku: tx.product?.sku,
          category: tx.product?.category,
          total_sold: 0
        };
      }
      productMap[tx.product_id].total_sold += tx.quantity;
    });

    const top = Object.values(productMap)
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 10);

    res.json({ top_products: top });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/dead-stock
router.get('/dead-stock', authenticate, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { days = 60 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    // Get all products
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name, sku, category, price')
      .eq('organization_id', orgId)
      .eq('is_deleted', false);

    if (pErr) throw pErr;

    const { data: allTx, error: txErr } = await supabase
      .from('transactions')
      .select('product_id, type, quantity, created_at')
      .eq('organization_id', orgId);

    if (txErr) throw txErr;

    const txByProduct = {};
    (allTx || []).forEach(tx => {
      if (!txByProduct[tx.product_id]) txByProduct[tx.product_id] = [];
      txByProduct[tx.product_id].push(tx);
    });

    const deadStock = (products || []).filter(p => {
      const txs = txByProduct[p.id] || [];
      const stock = txs.reduce((acc, tx) =>
        tx.type === 'IN' ? acc + tx.quantity : acc - tx.quantity, 0);
      if (stock <= 0) return false; // out of stock, not dead stock

      const recentSale = txs.some(tx =>
        tx.type === 'OUT' && new Date(tx.created_at) > since);
      return !recentSale;
    }).map(p => {
      const txs = txByProduct[p.id] || [];
      const stock = txs.reduce((acc, tx) =>
        tx.type === 'IN' ? acc + tx.quantity : acc - tx.quantity, 0);
      return { id: p.id, name: p.name, sku: p.sku, category: p.category, current_stock: stock, value: stock * p.price };
    });

    res.json({ dead_stock: deadStock, total_items: deadStock.length });
  } catch (err) {
    next(err);
  }
});

export default router;
