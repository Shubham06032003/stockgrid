import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';

export async function checkLowStockAlert(productId, productName, currentStock, minStock, organizationId, userId) {
  try {
    if (currentStock <= minStock) {
      const alertType = currentStock <= 0 ? 'out_of_stock' : 'low_stock';

      // Check for existing unresolved alert
      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('product_id', productId)
        .eq('organization_id', organizationId)
        .eq('type', alertType)
        .eq('resolved', false)
        .single();

      if (!existing) {
        await supabase.from('alerts').insert({
          id: uuidv4(),
          product_id: productId,
          organization_id: organizationId,
          type: alertType,
          message: currentStock <= 0
            ? `${productName} is OUT OF STOCK`
            : `${productName} has low stock: ${currentStock} units remaining (min: ${minStock})`,
          current_stock: currentStock,
          min_stock: minStock,
          resolved: false,
          created_by: userId
        });
      }
    } else {
      // Resolve any existing alerts if stock is now above min
      await supabase.from('alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('product_id', productId)
        .eq('organization_id', organizationId)
        .eq('resolved', false);
    }
  } catch (err) {
    console.error('Alert check failed:', err);
  }
}
