if (!process.env.VERCEL) {
  require('dotenv').config();
}

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let openIdConnectModule = null;
let openIdConnectLoadError = null;
try {
  // Top-level require so @vercel/nft includes Auth0 deps in the serverless bundle.
  openIdConnectModule = require('express-openid-connect');
} catch (err) {
  openIdConnectLoadError = err;
  console.warn('express-openid-connect failed to load — login will be disabled.', err);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel (and other reverse proxies) terminate TLS; Auth0 cookies need correct secure/proto.
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const AUTH0_SECRET_MIN_LENGTH = 32;

function getAuthEnv(name) {
  const raw = process.env[name];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
}

function hasAuthEnvVars() {
  return Boolean(
    getAuthEnv('AUTH0_SECRET') &&
      getAuthEnv('AUTH0_BASE_URL') &&
      getAuthEnv('AUTH0_CLIENT_ID') &&
      getAuthEnv('AUTH0_ISSUER_BASE_URL') &&
      getAuthEnv('AUTH0_CLIENT_SECRET')
  );
}

function isAuthSecretValid() {
  const secret = getAuthEnv('AUTH0_SECRET');
  return typeof secret === 'string' && secret.length >= AUTH0_SECRET_MIN_LENGTH;
}

function isAuthConfigured() {
  return hasAuthEnvVars() && isAuthSecretValid();
}

function loadOpenIdConnect() {
  if (!openIdConnectModule) {
    throw openIdConnectLoadError || new Error('express-openid-connect is not available');
  }
  return openIdConnectModule;
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

// Public routes (registered before Auth0 so health checks never depend on session middleware).
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
let authInitError = null;

if (isAuthConfigured()) {
  try {
    const { auth } = loadOpenIdConnect();
    app.use(
      auth({
        authRequired: false,
        auth0Logout: true,
        secret: getAuthEnv('AUTH0_SECRET'),
        baseURL: getAuthEnv('AUTH0_BASE_URL'),
        clientID: getAuthEnv('AUTH0_CLIENT_ID'),
        issuerBaseURL: getAuthEnv('AUTH0_ISSUER_BASE_URL'),
        clientSecret: getAuthEnv('AUTH0_CLIENT_SECRET'),
        session: {
          rolling: false,
        },
      })
    );
    authMiddlewareEnabled = true;
  } catch (err) {
    authInitError = err;
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
  if (!isAuthConfigured() || !authMiddlewareEnabled) {
    return res.status(503).json({ error: 'Auth0 is not configured. Login is unavailable.' });
  }
  const { requiresAuth } = loadOpenIdConnect();
  return requiresAuth()(req, res, next);
}

app.get('/api/me', (req, res) => {
  if (!isAuthConfigured() || !authMiddlewareEnabled || !req.oidc?.isAuthenticated()) {
    return res.json({
      authenticated: false,
      authConfigured: isAuthConfigured(),
      loginAvailable: authMiddlewareEnabled,
      openIdLoaded: Boolean(openIdConnectModule),
      authLoadError: openIdConnectLoadError?.message,
      authInitError: authInitError?.message,
    });
  }

  const user = req.oidc.user;
  res.json({
    authenticated: true,
    authConfigured: true,
    loginAvailable: true,
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
