const axios = require('axios');
const { getDb, saveDatabase } = require('./database');

// Model pricing lookup
function getModelCost(providerSlug, model, inputTokens, outputTokens) {
  const db = getDb();
  const result = db.exec(
    "SELECT input_price_per_1k, output_price_per_1k FROM model_pricing WHERE provider_slug = ? AND model = ?",
    [providerSlug, model]
  );
  if (result.length > 0 && result[0].values.length > 0) {
    const [inputPrice, outputPrice] = result[0].values[0];
    return (inputTokens / 1000) * inputPrice + (outputTokens / 1000) * outputPrice;
  }
  return 0;
}

function logUsage({ providerId, providerSlug, model, inputTokens, outputTokens, totalTokens, endpoint, userLabel, requestId, statusCode, responseTimeMs }) {
  const db = getDb();
  const cost = getModelCost(providerSlug, model, inputTokens, outputTokens);
  db.run(
    `INSERT INTO usage_logs (provider_id, model, input_tokens, output_tokens, total_tokens, cost, endpoint, user_label, request_id, status_code, response_time_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [providerId, model, inputTokens, outputTokens, totalTokens, cost, endpoint, userLabel || '', requestId || '', statusCode, responseTimeMs]
  );
  saveDatabase();
  return cost;
}

function getProviderBySlug(slug) {
  const db = getDb();
  const result = db.exec("SELECT * FROM providers WHERE slug = ?", [slug]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const cols = result[0].columns;
  const row = result[0].values[0];
  const provider = {};
  cols.forEach((col, i) => provider[col] = row[i]);
  return provider;
}

// ===== OpenAI Proxy =====
async function proxyOpenAI(req, res) {
  const provider = getProviderBySlug('openai');
  if (!provider || !provider.api_key_encrypted) {
    return res.status(400).json({ error: 'OpenAI API key not configured' });
  }

  const startTime = Date.now();
  const endpoint = req.path.replace('/api/proxy/openai', '');
  const targetUrl = `https://api.openai.com${endpoint}`;

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'Authorization': `Bearer ${provider.api_key_encrypted}`,
        'Content-Type': 'application/json',
      },
      data: req.body,
    });

    const responseTime = Date.now() - startTime;
    const data = response.data;

    // Extract usage from response
    if (data.usage) {
      logUsage({
        providerId: provider.id,
        providerSlug: 'openai',
        model: data.model || req.body.model || 'unknown',
        inputTokens: data.usage.prompt_tokens || 0,
        outputTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
        endpoint,
        userLabel: req.headers['x-user-label'] || '',
        requestId: data.id || '',
        statusCode: response.status,
        responseTimeMs: responseTime,
      });
    }

    res.status(response.status).json(data);
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const status = err.response?.status || 500;
    const errorData = err.response?.data || { error: err.message };

    // Log failed requests too
    logUsage({
      providerId: provider.id,
      providerSlug: 'openai',
      model: req.body?.model || 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      endpoint,
      userLabel: req.headers['x-user-label'] || '',
      requestId: '',
      statusCode: status,
      responseTimeMs: responseTime,
    });

    res.status(status).json(errorData);
  }
}

// ===== Anthropic Proxy =====
async function proxyAnthropic(req, res) {
  const provider = getProviderBySlug('anthropic');
  if (!provider || !provider.api_key_encrypted) {
    return res.status(400).json({ error: 'Anthropic API key not configured' });
  }

  const startTime = Date.now();
  const endpoint = req.path.replace('/api/proxy/anthropic', '');
  const targetUrl = `https://api.anthropic.com${endpoint}`;

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'x-api-key': provider.api_key_encrypted,
        'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
        'Content-Type': 'application/json',
      },
      data: req.body,
    });

    const responseTime = Date.now() - startTime;
    const data = response.data;

    if (data.usage) {
      logUsage({
        providerId: provider.id,
        providerSlug: 'anthropic',
        model: data.model || req.body.model || 'unknown',
        inputTokens: data.usage.input_tokens || 0,
        outputTokens: data.usage.output_tokens || 0,
        totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        endpoint,
        userLabel: req.headers['x-user-label'] || '',
        requestId: data.id || '',
        statusCode: response.status,
        responseTimeMs: responseTime,
      });
    }

    res.status(response.status).json(data);
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const status = err.response?.status || 500;
    const errorData = err.response?.data || { error: err.message };

    logUsage({
      providerId: provider.id,
      providerSlug: 'anthropic',
      model: req.body?.model || 'unknown',
      inputTokens: 0, outputTokens: 0, totalTokens: 0,
      endpoint, userLabel: req.headers['x-user-label'] || '',
      requestId: '', statusCode: status, responseTimeMs: responseTime,
    });

    res.status(status).json(errorData);
  }
}

// ===== Gemini Proxy =====
async function proxyGemini(req, res) {
  const provider = getProviderBySlug('gemini');
  if (!provider || !provider.api_key_encrypted) {
    return res.status(400).json({ error: 'Gemini API key not configured' });
  }

  const startTime = Date.now();
  const endpoint = req.path.replace('/api/proxy/gemini', '');
  const model = req.body?.model || req.params.model || 'gemini-2.0-flash';
  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.api_key_encrypted}`;

  try {
    const response = await axios({
      method: 'POST',
      url: targetUrl,
      headers: { 'Content-Type': 'application/json' },
      data: req.body,
    });

    const responseTime = Date.now() - startTime;
    const data = response.data;

    if (data.usageMetadata) {
      const inputTokens = data.usageMetadata.promptTokenCount || 0;
      const outputTokens = data.usageMetadata.candidatesTokenCount || 0;
      logUsage({
        providerId: provider.id,
        providerSlug: 'gemini',
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        endpoint,
        userLabel: req.headers['x-user-label'] || '',
        requestId: '',
        statusCode: response.status,
        responseTimeMs: responseTime,
      });
    }

    res.status(response.status).json(data);
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const status = err.response?.status || 500;
    const errorData = err.response?.data || { error: err.message };

    logUsage({
      providerId: provider.id, providerSlug: 'gemini', model,
      inputTokens: 0, outputTokens: 0, totalTokens: 0,
      endpoint, userLabel: req.headers['x-user-label'] || '',
      requestId: '', statusCode: status, responseTimeMs: responseTime,
    });

    res.status(status).json(errorData);
  }
}

module.exports = { proxyOpenAI, proxyAnthropic, proxyGemini };
