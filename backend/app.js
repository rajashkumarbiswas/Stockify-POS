const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const sanitize = require('./middleware/sanitize');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
// Needed for correct client IPs / secure cookies behind a reverse proxy (Next rewrite, Nginx...)
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

if (!env.isProduction) app.use(morgan('dev'));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitize); // strips "$operator" keys from body/query/params

// Global rate limit (stricter limits are applied to /auth/login)
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.', errors: [] },
  })
);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;