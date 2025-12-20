const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../../.env' });

const usersRouter = require('./routes/users');
const productsRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const analyticsRouter = require('./routes/analytics');
const cartsRouter = require('./routes/carts');
const contactsRouter = require('./routes/contacts');
const adminRouter = require('./routes/admin');
const adminUsersRouter = require('./routes/adminUsers');
const adminRolesRouter = require('./routes/adminRoles');
const ordersRouter = require('./routes/orders');
const adminOrdersRouter = require('./routes/adminOrders');
const adminCartsRouter = require('./routes/adminCarts');

const app = express();
const PORT = process.env.PORT || 4000;

// small performance improvements
const compression = require('compression');

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS configuration
// Support a single FRONTEND_ORIGIN or a comma-separated FRONTEND_ORIGINS env var.
// If none provided, default to allowing all origins (development convenience).
const rawOrigins = process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
const allowedOrigins = rawOrigins
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  // handle preflight success status for older browsers
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    // in development, allow common localhost hosts regardless of env config
    if (process.env.NODE_ENV !== 'production') {
      try {
        const url = new URL(origin);
        const host = url.hostname;
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
          return callback(null, true);
        }
      } catch (e) {
        // if origin is not a valid URL, fall through to configured allowlist
      }
    }

    // if no specific origins configured, allow all
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    const err = new Error('CORS_NOT_ALLOWED');
    err.origin = origin;
    err.allowed = allowedOrigins;
    return callback(err);
  },
};

app.use((req, res, next) => {
  // quick debug header when CORS blocked externally
  res.setHeader('X-App-Server', 'realtech-backend');
  next();
});

app.use(cors(corsOptions));

app.get('/', (req, res) => res.json({ ok: true, message: 'Backend API for Site Web RealTech' }));

app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/analytics', analyticsRouter);
// legacy/fallback path used by frontend
app.use('/api/analytics_visits', analyticsRouter);
app.use('/api/carts', cartsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/roles', adminRolesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/carts', adminCartsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
