import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generateSKU } from '../utils/skuGenerator.js';
import aiService from '../services/aiService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function normalizeHeader(value = '') {
  return String(value)
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getTrimmedValue(row, columnName) {
  if (!columnName) return null;
  const value = row[columnName];
  if (value === undefined || value === null) return null;
  return String(value).trim();
}

function parseDecimalValue(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = parseFloat(String(value).replace(/,/g, '').trim());
  return Number.isNaN(parsed) ? null : parsed;
}

function parseIntegerValue(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = parseInt(String(value).replace(/,/g, '').trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeSupplierKey(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeSku(value = '') {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

function buildUniqueSku(baseSku, existingSkus, seenSkus) {
  const normalizedBase = normalizeSku(baseSku) || 'GEN-PROD';
  let candidate = normalizedBase;
  let suffix = 2;

  while (existingSkus.has(candidate) || seenSkus.has(candidate)) {
    const suffixText = `-${suffix}`;
    candidate = `${normalizedBase.substring(0, Math.max(1, 100 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  seenSkus.add(candidate);

  return {
    sku: candidate,
    adjusted: candidate !== normalizedBase,
  };
}

function chunkArray(items = [], size = 50) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sanitizeImportError(error, fallback = 'Import failed for this row') {
  const rawMessage =
    error?.message ||
    error?.details ||
    error?.hint ||
    error?.error_description ||
    fallback;

  return String(rawMessage)
    .replace(/\s+/g, ' ')
    .replace(/^duplicate key value violates unique constraint.*$/i, 'SKU already exists in your inventory')
    .trim();
}

function inferProductMapping(headers = []) {
  const headerLookup = {};
  headers.forEach((header) => {
    headerLookup[normalizeHeader(header)] = header;
  });

  const candidates = {
    name: ['name', 'product_name', 'product', 'item_name', 'item', 'title'],
    sku: ['sku', 'product_code', 'item_code', 'code', 'product_sku'],
    price: ['price', 'unit_price', 'selling_price', 'sale_price', 'mrp', 'cost', 'cost_price'],
    category: ['category', 'product_category', 'group', 'type'],
    supplier: ['supplier', 'supplier_name', 'vendor', 'vendor_name', 'brand'],
    min_stock: ['min_stock', 'minimum_stock', 'reorder_level', 'reorder_point', 'low_stock_threshold'],
    initial_stock: ['initial_stock', 'opening_stock', 'stock', 'current_stock', 'quantity', 'qty', 'opening_qty'],
    description: ['description', 'product_description', 'details', 'notes'],
    unit: ['unit', 'uom', 'unit_of_measure', 'measure'],
  };

  return Object.entries(candidates).reduce((acc, [field, possibleHeaders]) => {
    const matchedHeader = possibleHeaders.map((key) => headerLookup[key]).find(Boolean);
    if (matchedHeader) acc[field] = matchedHeader;
    return acc;
  }, {});
}

// POST /api/import
router.post('/import', authenticate, requireRole('admin', 'manager'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { mapping: mappingStr, dry_run } = req.body;
    let mapping = {};
    try { mapping = JSON.parse(mappingStr || '{}'); } catch {}

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    let rows = [];

    if (ext === 'csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        const stream = Readable.from(req.file.buffer.toString());
        stream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
      rows = results;
    } else if (['xlsx', 'xls'].includes(ext)) {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(worksheet);
    } else {
      return res.status(400).json({ error: 'Only CSV and Excel files supported' });
    }

    if (rows.length === 0) return res.status(400).json({ error: 'File is empty' });

    const headers = Object.keys(rows[0]);
    if (Object.keys(mapping).length === 0) {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
          mapping = await aiService.mapCSVColumns(headers, rows.slice(0, Math.min(50, rows.length)));
          break;
        } catch (err) {
          if (attempt === 4) {
            mapping = inferProductMapping(headers);
            if (!mapping.name && headers.length > 0) {
              mapping.name = headers[0];
            }
          } else {
            await delay(Math.pow(2, attempt) * 500);
          }
        }
      }
    }

    const orgId = req.user.organization_id;
    const userId = req.user.id;
    const { data: existingProducts, error: existingProductsError } = await supabase
      .from('products')
      .select('sku')
      .eq('organization_id', orgId)
      .eq('is_deleted', false);

    if (existingProductsError) throw existingProductsError;

    const existingSkuSet = new Set(
      (existingProducts || [])
        .map((product) => normalizeSku(product.sku))
        .filter(Boolean)
    );
    const seenSkuSet = new Set();
    const validRows = [];
    const errorRows = [];

    rows.forEach((row, index) => {
      const rowErrors = [];
      const originalSku = getTrimmedValue(row, mapping.sku);
      const name = getTrimmedValue(row, mapping.name);
      const rawPrice = getTrimmedValue(row, mapping.price);
      const rawCategory = getTrimmedValue(row, mapping.category);
      const rawSupplierName = getTrimmedValue(row, mapping.supplier);
      const rawMinStock = getTrimmedValue(row, mapping.min_stock);
      const rawInitialStock = getTrimmedValue(row, mapping.initial_stock);
      const price = parseDecimalValue(rawPrice, 0);
      const minStock = mapping.min_stock ? parseIntegerValue(rawMinStock, 5) : 5;
      const initialStock = mapping.initial_stock ? parseIntegerValue(rawInitialStock, 0) : 0;

      if (!name) rowErrors.push('Name is required');
      if (price === null) rowErrors.push('Price must be a number');
      if (minStock === null) rowErrors.push('Min stock must be a whole number');
      if (initialStock === null) rowErrors.push('Initial stock must be a whole number');
      if (minStock !== null && minStock < 0) rowErrors.push('Min stock cannot be negative');
      if (initialStock !== null && initialStock < 0) rowErrors.push('Initial stock cannot be negative');

      const category = rawCategory || 'Uncategorized';
      const skuSeed = originalSku || generateSKU(name || 'PRODUCT', category);
      const { sku: finalSku, adjusted: skuAdjusted } = buildUniqueSku(skuSeed, existingSkuSet, seenSkuSet);

      const normalizedRow = {
        row_number: index + 2,
        name,
        original_sku: originalSku || null,
        sku: finalSku,
        sku_adjusted: skuAdjusted,
        price: price ?? 0,
        category,
        supplier_name: rawSupplierName || null,
        min_stock: minStock ?? 5,
        description: getTrimmedValue(row, mapping.description),
        unit: getTrimmedValue(row, mapping.unit) || 'units',
        initial_stock: initialStock ?? 0,
      };

      if (rowErrors.length > 0) {
        errorRows.push({
          row: index + 2,
          product_name: name || null,
          original_sku: originalSku || null,
          final_sku: finalSku,
          error_type: 'validation',
          errors: rowErrors,
          message: rowErrors.join(', '),
          data: row,
        });
      } else {
        validRows.push(normalizedRow);
      }
    });

    if (dry_run === 'true') {
      return res.json({
        preview: validRows.slice(0, 10),
        valid_count: validRows.length,
        error_count: errorRows.length,
        errors: errorRows,
        headers,
        mapping,
        import_summary: `${validRows.length} valid row(s), ${errorRows.length} row(s) flagged during preview.`,
      });
    }

    const supplierMap = {};
    const unmappedSuppliers = new Set();
    const supplierWarningSet = new Set();
    const uniqueSupplierNames = [...new Set(
      validRows
        .map((row) => row.supplier_name)
        .filter(Boolean)
        .map((name) => name.trim())
        .filter(Boolean)
    )];

    if (uniqueSupplierNames.length > 0) {
      const { data: existingSuppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('organization_id', orgId)
        .eq('is_deleted', false);

      if (suppliersError) throw suppliersError;

      (existingSuppliers || []).forEach((supplier) => {
        supplierMap[normalizeSupplierKey(supplier.name)] = supplier.id;
      });

      uniqueSupplierNames.forEach((name) => {
        if (!supplierMap[normalizeSupplierKey(name)]) {
          unmappedSuppliers.add(name);
        }
      });
    }

    const preparedRows = validRows.map((row) => {
      const supplierKey = row.supplier_name ? normalizeSupplierKey(row.supplier_name) : null;
      const supplierId = supplierKey ? supplierMap[supplierKey] || null : null;

      if (row.supplier_name && !supplierId) {
        supplierWarningSet.add(`Row ${row.row_number}: supplier "${row.supplier_name}" not found, imported without supplier link`);
      }

      return {
        ...row,
        product_id: uuidv4(),
        supplier_id: supplierId,
      };
    });

    const imported = [];
    const importErrors = [];
    const productRowById = new Map(preparedRows.map((row) => [row.product_id, row]));

    const importSingleRow = async (row) => {
      const productPayload = {
        id: row.product_id,
        name: row.name,
        sku: row.sku,
        price: row.price,
        category: row.category,
        supplier_id: row.supplier_id,
        min_stock: row.min_stock,
        description: row.description,
        unit: row.unit,
        organization_id: orgId,
        created_by: userId,
        is_deleted: false,
      };

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert(productPayload)
        .select()
        .single();

      if (productError) throw { stage: 'product', cause: productError };

      if (row.initial_stock > 0) {
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            id: uuidv4(),
            product_id: row.product_id,
            organization_id: orgId,
            type: 'IN',
            quantity: row.initial_stock,
            reason: 'CSV Import',
            created_by: userId,
          });

        if (transactionError) {
          await supabase
            .from('products')
            .delete()
            .eq('id', row.product_id)
            .eq('organization_id', orgId);

          throw { stage: 'transaction', cause: transactionError };
        }
      }

      imported.push({
        ...product,
        current_stock: row.initial_stock,
        imported_row: row.row_number,
      });
    };

    for (const batch of chunkArray(preparedRows, 50)) {
      const productPayloads = batch.map((row) => ({
        id: row.product_id,
        name: row.name,
        sku: row.sku,
        price: row.price,
        category: row.category,
        supplier_id: row.supplier_id,
        min_stock: row.min_stock,
        description: row.description,
        unit: row.unit,
        organization_id: orgId,
        created_by: userId,
        is_deleted: false,
      }));

      const { data: insertedProducts, error: batchProductError } = await supabase
        .from('products')
        .insert(productPayloads)
        .select();

      if (batchProductError) {
        for (const row of batch) {
          try {
            await importSingleRow(row);
          } catch (err) {
            importErrors.push({
              row: row.row_number,
              product_name: row.name,
              original_sku: row.original_sku || null,
              final_sku: row.sku,
              error_type: err?.stage === 'transaction' ? 'transaction' : 'database',
              message: sanitizeImportError(err?.cause || err),
            });
          }
        }
        continue;
      }

      const rowsNeedingTransactions = batch.filter((row) => row.initial_stock > 0);
      if (rowsNeedingTransactions.length > 0) {
        const transactionPayloads = rowsNeedingTransactions.map((row) => ({
          id: uuidv4(),
          product_id: row.product_id,
          organization_id: orgId,
          type: 'IN',
          quantity: row.initial_stock,
          reason: 'CSV Import',
          created_by: userId,
        }));

        const { error: transactionBatchError } = await supabase
          .from('transactions')
          .insert(transactionPayloads);

        if (transactionBatchError) {
          await supabase
            .from('products')
            .delete()
            .in('id', batch.map((row) => row.product_id))
            .eq('organization_id', orgId);

          batch.forEach((row) => {
            importErrors.push({
              row: row.row_number,
              product_name: row.name,
              original_sku: row.original_sku || null,
              final_sku: row.sku,
              error_type: 'transaction',
              message: `Initial stock transaction failed: ${sanitizeImportError(transactionBatchError)}`,
            });
          });
          continue;
        }
      }

      (insertedProducts || []).forEach((product) => {
        const sourceRow = productRowById.get(product.id);
        imported.push({
          ...product,
          current_stock: sourceRow?.initial_stock ?? 0,
          imported_row: sourceRow?.row_number,
        });
      });
    }

    const allErrors = [...errorRows, ...importErrors];
    const importSummary =
      imported.length === 0 && allErrors.length > 0
        ? `Import failed. ${allErrors.length} row(s) could not be imported.`
        : allErrors.length > 0
          ? `${imported.length} row(s) imported, ${allErrors.length} row(s) skipped.`
          : `Imported ${imported.length} row(s) successfully.`;

    res.json({
      imported_count: imported.length,
      error_count: allErrors.length,
      errors: allErrors,
      products: imported.slice(0, 20),
      supplier_warnings: [...supplierWarningSet],
      unmapped_suppliers: [...unmappedSuppliers],
      import_summary: importSummary,
    });
  } catch (err) {
    next(err);
  }
});
// GET /api/export/products
router.get('/export/products', authenticate, async (req, res, next) => {
  try {
    const { format = 'csv', category, stock_status } = req.query;
    const orgId = req.user.organization_id;

    const { data: products, error } = await supabase
      .from('products')
      .select('*, supplier:suppliers(name), transactions(type, quantity)')
      .eq('organization_id', orgId)
      .eq('is_deleted', false)
      .order('name');

    if (error) throw error;

    const rows = products.map(p => {
      const stock = (p.transactions || []).reduce((acc, tx) =>
        tx.type === 'IN' ? acc + tx.quantity : acc - tx.quantity, 0);
      return {
        Name: p.name,
        SKU: p.sku,
        Category: p.category,
        'Unit Price': p.price,
        'Current Stock': stock,
        'Min Stock': p.min_stock,
        'Stock Value': Math.round(stock * p.price * 100) / 100,
        Supplier: p.supplier?.name || p.supplier_name || '',
        Unit: p.unit || 'units',
        Description: p.description || '',
        Status: stock <= 0 ? 'Out of Stock' : stock <= p.min_stock ? 'Low Stock' : 'In Stock',
        'Created At': new Date(p.created_at).toLocaleDateString()
      };
    });

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    // CSV
    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// GET /api/export/transactions
router.get('/export/transactions', authenticate, async (req, res, next) => {
  try {
    const { format = 'csv', start_date, end_date } = req.query;
    const orgId = req.user.organization_id;

    let query = supabase
      .from('transactions')
      .select('*, product:products(name, sku), user:users(name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date + 'T23:59:59');

    const { data, error } = await query;
    if (error) throw error;

    const rows = data.map(tx => ({
      Date: new Date(tx.created_at).toLocaleDateString(),
      Type: tx.type,
      Product: tx.product?.name || '',
      SKU: tx.product?.sku || '',
      Quantity: tx.quantity,
      Reason: tx.reason || '',
      Reference: tx.reference_no || '',
      'Performed By': tx.user?.name || '',
      Notes: tx.notes || ''
    }));

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Transactions');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// POST /api/import/suppliers
router.post('/import/suppliers', authenticate, requireRole('admin', 'manager'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { mapping: mappingStr, dry_run } = req.body;
    let mapping = {};
    try { mapping = JSON.parse(mappingStr || '{}'); } catch {}

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    let rows = [];

    if (ext === 'csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        const stream = Readable.from(req.file.buffer.toString());
        stream.pipe(csv())
          .on('data', data => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
      rows = results;
    } else if (['xlsx', 'xls'].includes(ext)) {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws);
    } else {
      return res.status(400).json({ error: 'Only CSV and Excel files supported' });
    }

    if (rows.length === 0) return res.status(400).json({ error: 'File is empty' });

    const headers = Object.keys(rows[0]);

    // If no mapping provided, use AI or heuristics to detect columns
    if (Object.keys(mapping).length === 0) {
      const delay = ms => new Promise(res => setTimeout(res, ms));
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          mapping = await aiService.mapSupplierColumns(headers, rows.slice(0, Math.min(20, rows.length)));
          break;
        } catch (err) {
          if (attempt === 3) {
            headers.forEach(h => {
              const norm = h.toLowerCase().trim().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, '_');
              if (['name', 'supplier', 'supplier_name', 'company', 'company_name'].includes(norm)) mapping.name = h;
              if (['email', 'contact_email'].includes(norm)) mapping.contact_email = h;
              if (['phone', 'mobile', 'phone_number', 'contact_number'].includes(norm)) mapping.phone = h;
              if (['address', 'full_address', 'location'].includes(norm)) mapping.address = h;
              if (['lead_time', 'lead_time_days', 'delivery_days'].includes(norm)) mapping.lead_time_days = h;
              if (['notes', 'remark', 'remarks', 'description'].includes(norm)) mapping.notes = h;
            });
            if (!mapping.name && headers.length > 0) mapping.name = headers[0];
          } else {
            await delay(1000 * attempt);
          }
        }
      }
    }

    const validRows = [];
    const errorRows = [];

    rows.forEach((row, idx) => {
      const errors = [];
      const name = mapping.name ? row[mapping.name] : null;

      if (!name || name.toString().trim() === '') errors.push('Name is required');

      const transformed = {
        name: name?.toString().trim(),
        contact_email: mapping.contact_email ? row[mapping.contact_email]?.toString().trim() : null,
        phone: mapping.phone ? row[mapping.phone]?.toString().trim() : null,
        address: mapping.address ? row[mapping.address]?.toString().trim() : null,
        lead_time_days: mapping.lead_time_days ? parseInt(row[mapping.lead_time_days]) || null : null,
        notes: mapping.notes ? row[mapping.notes]?.toString().trim() : null,
      };

      if (errors.length > 0) {
        errorRows.push({ row: idx + 2, data: row, errors });
      } else {
        validRows.push(transformed);
      }
    });

    if (dry_run === 'true') {
      return res.json({
        preview: validRows.slice(0, 10),
        valid_count: validRows.length,
        error_count: errorRows.length,
        errors: errorRows,
        headers,
        mapping
      });
    }

    const orgId = req.user.organization_id;
    const imported = [];
    const importErrors = [];
    const chunkSize = 300;

    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (row) => {
        try {
          const supplierId = uuidv4();
          const { data: supplier, error: sErr } = await supabase
            .from('suppliers')
            .insert({
              id: supplierId,
              ...row,
              organization_id: orgId,
              is_deleted: false
            })
            .select()
            .single();

          if (sErr) throw sErr;
          return { success: true, supplier };
        } catch (err) {
          return { success: false, row: row.name, error: err.message };
        }
      });
      
      const results = await Promise.all(promises);
      results.forEach(res => {
        if (res.success) imported.push(res.supplier);
        else importErrors.push({ row: res.row, error: res.error });
      });
    }

    res.json({
      imported_count: imported.length,
      error_count: importErrors.length + errorRows.length,
      errors: [...errorRows, ...importErrors],
      suppliers: imported.slice(0, 20)
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/export/suppliers
router.get('/export/suppliers', authenticate, async (req, res, next) => {
  try {
    const { format = 'csv', ids } = req.query;
    const orgId = req.user.organization_id;

    let query = supabase
      .from('suppliers')
      .select('*, products(id)')
      .eq('organization_id', orgId)
      .order('name');
      
    if (ids) {
      const idArray = ids.split(',').filter(id => id.trim());
      if (idArray.length > 0) {
        query = query.in('id', idArray);
      }
    }

    const { data: suppliers, error } = await query;
    if (error) throw error;

    const rows = suppliers.map(s => ({
      Name: s.name,
      'Contact Email': s.contact_email || '',
      Phone: s.phone || '',
      Address: s.address || '',
      'Lead Time (Days)': s.lead_time_days || '',
      'Products Supplied': s.products ? s.products.length : 0,
      Notes: s.notes || '',
      'Created At': new Date(s.created_at).toLocaleDateString()
    }));

    if (rows.length === 0) {
      rows.push({
        Name: '', 'Contact Email': '', Phone: '', Address: '', 'Lead Time (Days)': '', 'Products Supplied': '', Notes: '', 'Created At': ''
      });
    }

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=suppliers.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Disposition', 'attachment; filename=suppliers.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

export default router;
