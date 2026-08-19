require('dotenv').config();

const express = require('express');
const path = require('path');
const { auth, requiresAuth } = require('express-openid-connect');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: process.env.AUTH0_BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
  })
);

app.use(express.static(path.join(__dirname, 'public')));

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { client: null, error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.' };
  }

  return { client: createClient(url, anonKey), error: null };
}

async function checkDatabaseConnection() {
  const { client, error } = getSupabaseClient();

  if (!client) {
    return { connected: false, message: error };
  }

  const { error: queryError } = await client.from('notes').select('id').limit(1);

  if (queryError) {
    return { connected: false, message: queryError.message };
  }

  return { connected: true, message: 'Connected' };
}

app.get('/api/me', (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.json({ authenticated: false });
  }

  const user = req.oidc.user;
  res.json({
    authenticated: true,
    name: user.name || user.nickname || user.email,
    email: user.email,
  });
});

app.get('/api/status', async (_req, res) => {
  const status = await checkDatabaseConnection();
  res.json(status);
});

app.get('/api/notes', async (_req, res) => {
  const { client, error } = getSupabaseClient();

  if (!client) {
    return res.json({ notes: [], error });
  }

  const { data, error: queryError } = await client
    .from('notes')
    .select('id, name, message, created_at')
    .order('created_at', { ascending: false });

  if (queryError) {
    return res.json({ notes: [], error: queryError.message });
  }

  res.json({ notes: data ?? [] });
});

app.post('/api/notes', requiresAuth(), async (req, res) => {
  const { name, message } = req.body;

  if (!name?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Name and message are required.' });
  }

  const { client, error } = getSupabaseClient();

  if (!client) {
    return res.status(503).json({
      error: error || 'Database is not connected. Notes cannot be saved yet',
    });
  }

  const { data, error: insertError } = await client
    .from('notes')
    .insert({ name: name.trim(), message: message.trim() })
    .select('id, name, message, created_at')
    .single();

  if (insertError) {
    return res.status(503).json({ error: insertError.message });
  }

  res.status(201).json({ note: data });
});

app.listen(PORT, () => {
  console.log(`Dev Lab is running at http://localhost:${PORT}`);
});
