import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const MODEL = 'gemini-2.5-flash-lite';

class AIService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY not set. AI features will be disabled.');
      this.enabled = false;
      return;
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: MODEL });
    this.enabled = true;
  }

  async _call(prompt, systemPrompt = '') {
    if (!this.enabled) throw new Error('AI service not configured. Please set GEMINI_API_KEY.');

    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;

    const result = await this.model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  }

  async _callJSON(prompt, systemPrompt = '') {
    const text = await this._call(prompt + '\n\nRespond ONLY with valid JSON. No markdown, no backticks, no explanation.', systemPrompt);
    try {
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      // Try to extract JSON
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
      throw new Error('AI returned invalid JSON: ' + text.substring(0, 200));
    }
  }

  // Chat assistant
  async chat(messages, context = '') {
    const systemPrompt = `You are an expert inventory management assistant for a business called "The Curator". 
You help managers and staff make smart inventory decisions based on data they provide.
Be concise, actionable, and data-driven in your responses.
${context ? `Business context: ${context}` : ''}`;

    const conversationHistory = messages.map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const lastMessage = messages[messages.length - 1];
    const prompt = `${conversationHistory}`;

    return await this._call(prompt, systemPrompt);
  }

  // Demand prediction
  async predictDemand(salesData, productName, days = 30) {
    const systemPrompt = `You are an inventory analytics AI. Analyze sales patterns and predict future demand.`;
    const prompt = `Analyze demand for "${productName}" and predict next ${days} days.

Historical sales data (last 90 days, daily quantities sold):
${JSON.stringify(salesData)}

Return JSON with this structure:
{
  "predicted_demand": number,
  "confidence": "high|medium|low",
  "trend": "increasing|stable|decreasing",
  "insight": "brief explanation",
  "recommendation": "action to take",
  "peak_periods": ["list of predicted high-demand periods"]
}`;

    return await this._callJSON(prompt, systemPrompt);
  }

  // Reorder suggestions
  async suggestReorder(products) {
    const systemPrompt = `You are an inventory optimization AI that helps prevent stockouts.`;
    const prompt = `Analyze these low-stock products and provide reorder recommendations:

${JSON.stringify(products)}

For each product, calculate if reorder is needed based on:
- avg_daily_sales: average daily sales
- lead_time_days: supplier lead time
- current_stock: current inventory
- min_stock: minimum threshold

Formula: reorder_qty = (avg_daily_sales × lead_time_days × 1.5) - current_stock

Return JSON:
{
  "recommendations": [
    {
      "product_id": "id",
      "product_name": "name",
      "current_stock": number,
      "suggested_order_qty": number,
      "urgency": "critical|high|medium|low",
      "reason": "explanation",
      "estimated_stockout_days": number
    }
  ],
  "summary": "overall summary"
}`;

    return await this._callJSON(prompt, systemPrompt);
  }

  // Dead stock analysis
  async analyzeDeadStock(deadStockItems) {
    const systemPrompt = `You are a retail inventory optimization specialist.`;
    const prompt = `These products haven't had any sales in 60+ days. Analyze and suggest actions:

${JSON.stringify(deadStockItems)}

Return JSON:
{
  "total_dead_stock_value": number,
  "recommendations": [
    {
      "product_id": "id",
      "product_name": "name",
      "action": "discount|bundle|return_to_supplier|write_off|seasonal",
      "suggested_discount_pct": number or null,
      "reason": "why this action"
    }
  ],
  "insight": "overall strategic insight"
}`;

    return await this._callJSON(prompt, systemPrompt);
  }

  // CSV column mapping for products
  async mapCSVColumns(headers, sampleData = []) {
    const systemPrompt = `You map CSV column headers to inventory system fields.`;
    const prompt = `Map these CSV column headers to the correct inventory fields:

Headers: ${JSON.stringify(headers)}
Sample data (first 3 rows): ${JSON.stringify(sampleData)}

Target fields: name, sku, price, category, supplier, min_stock, description, unit, initial_stock

Return JSON where key = target field, value = matching CSV header (or null if not found):
{
  "name": "column_header_or_null",
  "sku": "column_header_or_null",
  "price": "column_header_or_null",
  "category": "column_header_or_null",
  "supplier": "column_header_or_null",
  "min_stock": "column_header_or_null",
  "description": "column_header_or_null",
  "unit": "column_header_or_null",
  "initial_stock": "column_header_or_null"
}`;

    return await this._callJSON(prompt, systemPrompt);
  }

  // CSV column mapping for suppliers
  async mapSupplierColumns(headers, sampleData = []) {
    const systemPrompt = `You map CSV column headers to supplier database fields.`;
    const prompt = `Map these CSV column headers to the correct supplier fields:

Headers: ${JSON.stringify(headers)}
Sample data (first 3 rows): ${JSON.stringify(sampleData)}

Target fields: name, contact_email, phone, address, lead_time_days, notes

Return JSON where key = target field, value = matching CSV header (or null if not found):
{
  "name": "column_header_or_null",
  "contact_email": "column_header_or_null",
  "phone": "column_header_or_null",
  "address": "column_header_or_null",
  "lead_time_days": "column_header_or_null",
  "notes": "column_header_or_null"
}`;

    return await this._callJSON(prompt, systemPrompt);
  }

  // SKU generator
  async generateSKU(productName, category = '') {
    const prompt = `Generate a deterministic, structured SKU code for a product.
Product name: "${productName}"
Category: "${category}"

Rules:
- 6-12 characters max
- Uppercase letters and numbers only
- No spaces or special chars
- Must be strictly derived from the product name and category.
- First 3 chars represent the category, followed by chars from the product name.
- ALWAYS return the exact same SKU for the exact same input. Wait, no random numbers.

Return JSON: { "sku": "GENERATEDSKU" }`;

    const result = await this._callJSON(prompt);
    return result.sku;
  }

  // General insights from dashboard data
  async generateDashboardInsights(dashboardData) {
    const systemPrompt = `You are a business intelligence AI for inventory management.`;
    const prompt = `Analyze this inventory dashboard data and provide 3 key actionable insights:

${JSON.stringify(dashboardData)}

Return JSON:
{
  "insights": [
    {
      "type": "warning|opportunity|info",
      "title": "short title",
      "description": "detailed insight",
      "action": "recommended action"
    }
  ]
}`;

    return await this._callJSON(prompt, systemPrompt);
  }
}

export default new AIService();
