const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanMessage, SystemMessage } = require('langchain/schema');
const { Redis } = require('upstash-redis');

const app = express();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const ouraWebhookToken = process.env.OURA_WEBHOOK_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});
const callLimit = parseInt(process.env.OURA_CALL_LIMIT) || 1000; // Configurable limit

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });
const chatModel = new ChatOpenAI({ openAIApiKey: openaiApiKey });

app.use(express.json());

// Rate limiting middleware
const rateLimit = async (req, res, next) => {
  const ip = req.ip;
  const calls = await redis.get(`calls:${ip}`) || 0;
  if (calls >= callLimit) return res.status(429).json({ error: 'Rate limit exceeded' });
  await redis.incr(`calls:${ip}`);
  await redis.expire(`calls:${ip}`, 86400); // 24-hour window
  next();
};

app.use(rateLimit);

// Oura Webhook Route
app.post('/api/webhook', async (req, res) => {
  const receivedToken = req.headers['x-oura-webhook-token'];
  if (receivedToken !== ouraWebhookToken) return res.status(401).json({ error: 'Invalid token' });

  const { user_id, hrv_rmssd, sleep, activity } = req.body;
  console.log(`Received Oura data for user ${user_id}:`, req.body);

  if (user_id) {
    await supabase.from('user_data').upsert({
      user_id,
      timestamp: new Date(),
      hrv: hrv_rmssd || null,
      sleep_score: sleep?.score || null,
      steps: activity?.steps || null,
    }).then(() => updateInflammationScore(user_id));
  }

  res.status(200).end();
});

// Inflammation Score Endpoint
app.post('/api/calculate-score', async (req, res) => {
  const { user_id } = req.body;
  const { data: userData } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', user_id)
    .order('timestamp', { ascending: false })
    .limit(1);

  if (!userData.length) return res.status(404).json({ error: 'No data' });

  const latest = userData[0];
  const score = calculateScore(latest);
  await supabase.from('scores').upsert({ user_id, score, timestamp: new Date() });

  res.json({ score });
});

// HealthGPT Endpoint
app.post('/api/healthgpt', async (req, res) => {
  const { user_id, query } = req.body;
  const { data: userData } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', user_id)
    .order('timestamp', { ascending: false })
    .limit(10); // Recent data for context

  const messages = [
    new SystemMessage('You are a wellness coach. Use user data to suggest behaviors linked to outcomes.'),
    new HumanMessage(`User data: ${JSON.stringify(userData)}. Query: ${query}`),
  ];

  const response = await chatModel.call(messages);
  res.json({ response: response.content });
});

function calculateScore(data) {
  let score = 100;
  if (data.hrv < 50) score -= 20;
  if (data.sleep_score < 80) score -= 30;
  // Expand with more metrics (labs, food) in scaling
  return Math.max(0, score);
}

async function updateInflammationScore(user_id) {
  const score = await calculateScore(user_id); // Placeholder
  await supabase.from('scores').upsert({ user_id, score, timestamp: new Date() });
  // Notify via HealthGPT if threshold met
}

module.exports = app;