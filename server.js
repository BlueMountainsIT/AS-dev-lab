if (!process.env.VERCEL) {
  require('dotenv').config();
}

const express = require('express');
const path = require('path');
const { auth, requiresAuth } = require('express-openid-connect');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel (and other reverse proxies) terminate TLS; Auth0 cookies need correct secure/proto.
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const AUTH0_SECRET_MIN_LENGTH = 32;

function hasAuthEnvVars() {
  return Boolean(
    process.env.AUTH0_SECRET &&
      process.env.AUTH0_BASE_URL &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_ISSUER_BASE_URL &&
      process.env.AUTH0_CLIENT_SECRET
  );
}

function isAuthSecretValid() {
  const secret = process.env.AUTH0_SECRET;
  return typeof secret === 'string' && secret.length >= AUTH0_SECRET_MIN_LENGTH;
}

function isAuthConfigured() {
  return hasAuthEnvVars() && isAuthSecretValid();
}

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

// Public routes (registered before Auth0 so health and static assets never depend on session middleware).
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

let authMiddlewareEnabled = false;

// Auth0 session middleware can fail on misconfigured serverless; skip on Vercel until proxy/session is verified.
const shouldMountAuth = isAuthConfigured() && process.env.VERCEL !== '1';

if (shouldMountAuth) {
  try {
    app.use(
      auth({
        authRequired: false,
        auth0Logout: true,
        secret: process.env.AUTH0_SECRET,
        baseURL: process.env.AUTH0_BASE_URL,
        clientID: process.env.AUTH0_CLIENT_ID,
        issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
        clientSecret: process.env.AUTH0_CLIENT_SECRET,
        session: {
          rolling: false,
        },
      })
    );
    authMiddlewareEnabled = true;
  } catch (err) {
    console.warn('Auth0 middleware failed to initialize — login is disabled.', err);
  }
} else if (hasAuthEnvVars() && !isAuthSecretValid()) {
  console.warn(
    `AUTH0_SECRET must be at least ${AUTH0_SECRET_MIN_LENGTH} characters — login is disabled.`
  );
}

if (!authMiddlewareEnabled) {
  if (!hasAuthEnvVars()) {
    console.warn('Auth0 is not configured — the page will load, but login is disabled.');
  }
  app.get('/login', (_req, res) => res.redirect('/'));
  app.get('/logout', (_req, res) => res.redirect('/'));
}

function requireLogin(req, res, next) {
  if (!isAuthConfigured()) {
    return res.status(503).json({ error: 'Auth0 is not configured. Login is unavailable.' });
  }
  return requiresAuth()(req, res, next);
}

app.get('/api/me', (req, res) => {
  if (!isAuthConfigured() || !req.oidc?.isAuthenticated()) {
    return res.json({ authenticated: false, authConfigured: isAuthConfigured() });
  }

  const user = req.oidc.user;
  res.json({
    authenticated: true,
    authConfigured: true,
    name: user.name || user.nickname || user.email,
    email: user.email,
  });
});

app.post('/api/notes', requireLogin, async (req, res) => {
  const { name, message } = req.body;

  if (!name?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Name and message are required.' });
  }

  const { client, error } = getSupabaseClient();

  if (!client) {
    return res.status(503).json({
      error: error || 'Database is not connected. Notes cannot be saved yet.',
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

app.use((err, req, res, _next) => {
  console.error('Unhandled Express error:', {
    message: err?.message,
    stack: err?.stack,
    method: req.method,
    path: req.path,
  });

  if (res.headersSent) {
    return;
  }

  res.status(err.status || err.statusCode || 500).json({
    error: 'Internal server error',
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Dev Lab is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
