import express, { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import {
  checkDatabaseHealth,
  DbRunner,
  getDb,
  runInTransaction,
} from './database.ts';
import {
  ensureDatabaseInitialized,
  getSessionSecret,
  hashPassword,
  verifyPassword,
} from './db.ts';

dotenv.config();

export const app = express();

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const ALLOWED_ORDER_STATUSES = [
  'অর্ডার গ্রহণ করা হয়েছে।',
  'অর্ডার নিশ্চিত করা হয়েছে।',
  'পণ্য পাঠানো হয়েছে।',
  'ডেলিভারি সম্পন্ন হয়েছে।',
  'অর্ডার বাতিল হয়েছে।',
] as const;

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Legacy local uploads directory support (when running locally with previously uploaded files)
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (fs.existsSync(UPLOAD_DIR)) {
  app.use('/uploads', express.static(UPLOAD_DIR));
}

// Memory-storage Multer for Vercel-safe database-backed uploads (max 4MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('শুধুমাত্র JPG, PNG বা WebP ছবি আপলোড করা যাবে।'));
    }
  },
});

// Ensure database schema & seed data are ready before handling any /api request
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') {
    next();
    return;
  }
  try {
    await ensureDatabaseInitialized();
    next();
  } catch (error: any) {
    const msg = String(error?.message || '');
    console.error('Database initialization error:', msg);
    let userMessage = 'ডাটাবেজ সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে ডাটাবেজ কনফিগারেশন পরীক্ষা করুন।';
    if (/timeout|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|IPv6/i.test(msg)) {
      userMessage =
        'ডাটাবেজ সংযোগের সময়সীমা শেষ হয়েছে (Connection Timeout)। Supabase ব্যবহার করলে Direct URL-এর পরিবর্তে IPv4 Pooler URL (*.pooler.supabase.com) ব্যবহার করুন এবং ডাটাবেজ চালু আছে কি না পরীক্ষা করুন।';
    } else if (/password authentication|28P01|28000/i.test(msg)) {
      userMessage = 'ডাটাবেজ ইউজারনেম বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে DATABASE_URL যাচাই করুন।';
    }
    res.status(503).json({
      error: userMessage,
      code: 'DB_INIT_FAILED',
    });
  }
});

// Health & Database Diagnostics endpoint
app.get('/api/health', async (_req, res) => {
  const health = await checkDatabaseHealth();
  if (!health.ok) {
    res.status(503).json({
      status: 'error',
      database: health.engine,
      persistent: false,
      error: health.error,
    });
    return;
  }
  try {
    await ensureDatabaseInitialized();
    res.json({
      status: 'ok',
      database: health.engine,
      persistent: health.persistent,
      ...(health.warning ? { warning: health.warning } : {}),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      database: health.engine,
      persistent: health.persistent,
      error: error?.message || 'Database initialization error',
    });
  }
});

// Serve DB-backed uploaded images cleanly
app.get('/api/files/:id', async (req, res) => {
  try {
    const id = req.params.id.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!id) {
      res.status(404).end();
      return;
    }
    const db = await getDb();
    const file = await db.queryOne<{ mime_type: string; data_base64: string }>(
      'SELECT mime_type, data_base64 FROM uploaded_files WHERE id = ?',
      [id]
    );
    if (!file) {
      res.status(404).json({ error: 'ছবি পাওয়া যায়নি' });
      return;
    }
    const buffer = Buffer.from(file.data_base64, 'base64');
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch {
    res.status(500).end();
  }
});

// Token signing & verification with DB-backed secret + revocation support
interface TokenPayload {
  jti: string;
  username: string;
  exp: number;
}

async function signAdminToken(username: string): Promise<string> {
  const secret = await getSessionSecret();
  const payload: TokenPayload = {
    jti: crypto.randomBytes(16).toString('hex'),
    username,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

async function verifyAdminToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = await getSessionSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.jti || !payload.username || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    const db = await getDb();
    const revoked = await db.queryOne('SELECT 1 AS found FROM revoked_tokens WHERE jti = ?', [payload.jti]);
    if (revoked) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'অনুমোদন প্রয়োজন। অনুগ্রহ করে অ্যাডমিন লগইন করুন।' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const verified = await verifyAdminToken(token);
  if (!verified) {
    res.status(401).json({ error: 'সেশন মেয়াদোত্তীর্ণ হয়েছে। পুনরায় লগইন করুন।' });
    return;
  }
  (req as Request & { adminUser?: string }).adminUser = verified.username;
  next();
}

async function getSettingsObject(runner?: DbRunner): Promise<Record<string, unknown>> {
  const db = runner || (await getDb());
  const rows = await db.queryAll<{ key: string; value: string }>(
    "SELECT key, value FROM website_settings WHERE key != '_internal_session_secret'"
  );
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return {
    website_name: map.website_name || 'DSK SHOP BD',
    website_logo: map.website_logo || '',
    primary_color: map.primary_color || '#0F5132',
    secondary_color: map.secondary_color || '#B45309',
    button_color: map.button_color || '#0F5132',
    delivery_inside_dhaka: Number(map.delivery_inside_dhaka ?? 80),
    delivery_outside_dhaka: Number(map.delivery_outside_dhaka ?? 180),
    contact_phone: map.contact_phone || '',
    contact_email: map.contact_email || '',
    contact_address: map.contact_address || '',
    contact_hours: map.contact_hours || '',
    social_facebook: map.social_facebook || '',
    social_instagram: map.social_instagram || '',
    social_youtube: map.social_youtube || '',
    social_whatsapp: map.social_whatsapp || '',
    footer_about: map.footer_about || '',
    footer_copyright: map.footer_copyright || '',
    welcome_title: map.welcome_title || 'DSK SHOP BD-তে আপনাকে স্বাগতম!',
    welcome_message: map.welcome_message || '',
    special_offer_title: map.special_offer_title || '',
    special_offer_subtitle: map.special_offer_subtitle || '',
    special_offer_highlight: map.special_offer_highlight || '',
    show_banners: map.show_banners !== 'false',
    show_categories: map.show_categories !== 'false',
    show_featured: map.show_featured !== 'false',
    show_latest: map.show_latest !== 'false',
    show_popular: map.show_popular !== 'false',
    show_special_offers: map.show_special_offers !== 'false',
    show_reviews: map.show_reviews !== 'false',
    show_contact: map.show_contact !== 'false',
    section_title_featured: map.section_title_featured || 'বিশেষ নির্বাচিত পণ্য',
    section_title_latest: map.section_title_latest || 'নতুন সংযোজন',
    section_title_popular: map.section_title_popular || 'জনপ্রিয় পণ্যসমূহ',
    section_title_reviews: map.section_title_reviews || 'গ্রাহকদের ভালোবাসা ও মতামত',
  };
}

async function hydrateProducts(rows: Array<Record<string, unknown>>, runner?: DbRunner) {
  if (rows.length === 0) return [];
  const db = runner || (await getDb());
  const results = [];
  for (const row of rows) {
    const images = await db.queryAll(
      'SELECT id, product_id, image_url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
      [row.id]
    );
    results.push({
      ...row,
      id: Number(row.id),
      category_id: row.category_id !== null && row.category_id !== undefined ? Number(row.category_id) : null,
      regular_price: Number(row.regular_price),
      discount_price:
        row.discount_price !== null && row.discount_price !== undefined ? Number(row.discount_price) : null,
      stock: Number(row.stock),
      is_featured: Boolean(Number(row.is_featured)),
      is_popular: Boolean(Number(row.is_popular)),
      category_name: (row.category_name as string) || 'সাধারণ',
      images,
    });
  }
  return results;
}

async function hydrateOrders(rows: Array<Record<string, unknown>>, runner?: DbRunner) {
  if (rows.length === 0) return [];
  const db = runner || (await getDb());
  const results = [];
  for (const row of rows) {
    const items = await db.queryAll(
      'SELECT id, order_id, product_id, product_name, product_image, unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id ASC',
      [row.id]
    );
    results.push({
      ...row,
      id: Number(row.id),
      delivery_charge: Number(row.delivery_charge),
      subtotal: Number(row.subtotal),
      total_amount: Number(row.total_amount),
      items: items.map((item: any) => ({
        ...item,
        id: Number(item.id),
        order_id: Number(item.order_id),
        product_id: Number(item.product_id),
        unit_price: Number(item.unit_price),
        quantity: Number(item.quantity),
        line_total: Number(item.line_total),
      })),
    });
  }
  return results;
}

function normalizePhone(input: string): string {
  const bnToEn: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };
  let normalized = input
    .trim()
    .replace(/[০-৯]/g, (ch) => bnToEn[ch] ?? ch)
    .replace(/[\s\-()]/g, '');
  if (normalized.startsWith('+88')) {
    normalized = normalized.slice(3);
  } else if (normalized.startsWith('880') && normalized.length === 13) {
    normalized = '0' + normalized.slice(3);
  }
  return normalized;
}

function makeSlug(text: string): string {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return `${cleaned || 'item'}-${crypto.randomBytes(3).toString('hex')}`;
}

function sanitizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/api/files/') ||
    trimmed.startsWith('/src/assets/')
  ) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

// ==========================================
// PUBLIC STOREFRONT ENDPOINTS
// ==========================================

app.get('/api/storefront', async (_req, res) => {
  try {
    const db = await getDb();
    const settings = await getSettingsObject(db);

    const bannerRows = await db.queryAll<any>(
      'SELECT id, title, subtitle, cta_text, cta_link, image_url, is_active, sort_order FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    const banners = bannerRows.map((b) => ({
      ...b,
      id: Number(b.id),
      sort_order: Number(b.sort_order),
      is_active: Boolean(Number(b.is_active)),
    }));

    const categoryRows = await db.queryAll<any>(
      `SELECT c.id, c.name, c.slug, c.description, c.sort_order,
              COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.id ASC`
    );
    const categories = categoryRows.map((c) => ({
      ...c,
      id: Number(c.id),
      sort_order: Number(c.sort_order),
      product_count: Number(c.product_count ?? 0),
    }));

    const productRows = await db.queryAll<Record<string, unknown>>(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.status = 'active'
       ORDER BY p.created_at DESC, p.id DESC`
    );

    const reviewRows = await db.queryAll<any>(
      'SELECT id, customer_name, location, rating, comment, product_name, is_active, created_at FROM reviews WHERE is_active = 1 ORDER BY id DESC'
    );
    const reviews = reviewRows.map((r) => ({
      ...r,
      id: Number(r.id),
      rating: Number(r.rating),
      is_active: Boolean(Number(r.is_active)),
    }));

    res.json({
      settings,
      banners,
      categories,
      products: await hydrateProducts(productRows, db),
      reviews,
    });
  } catch (error) {
    console.error('Storefront fetch error:', error);
    res.status(500).json({ error: 'স্টোরের তথ্য লোড করতে সমস্যা হয়েছে।' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'সঠিক পণ্য আইডি দিন।' });
      return;
    }
    const db = await getDb();
    const row = await db.queryOne<Record<string, unknown>>(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ? AND p.status = 'active'`,
      [id]
    );

    if (!row) {
      res.status(404).json({ error: 'পণ্যটি পাওয়া যায়নি।' });
      return;
    }
    const hydrated = await hydrateProducts([row], db);
    res.json(hydrated[0]);
  } catch {
    res.status(500).json({ error: 'পণ্যের তথ্য পাওয়া যায়নি।' });
  }
});

// Direct Order Creation (NO cart, NO customer login)
app.post('/api/orders', async (req, res) => {
  try {
    const {
      productId,
      quantity,
      customerName,
      customerPhone,
      division,
      district,
      address,
      deliveryArea,
      clientRequestId,
    } = req.body ?? {};

    const parsedProductId = Number(productId);
    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
      res.status(400).json({ error: 'সঠিক পণ্য নির্বাচন করুন।' });
      return;
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 50) {
      res.status(400).json({ error: 'পণ্যের পরিমাণ ১ থেকে ৫০ এর মধ্যে হতে হবে।' });
      return;
    }

    const cleanName = typeof customerName === 'string' ? customerName.trim() : '';
    if (cleanName.length < 2 || cleanName.length > 100) {
      res.status(400).json({ error: 'অনুগ্রহ করে আপনার সম্পূর্ণ নাম লিখুন।' });
      return;
    }

    const cleanPhone = normalizePhone(typeof customerPhone === 'string' ? customerPhone : '');
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      res.status(400).json({ error: 'সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' });
      return;
    }

    const cleanDivision = typeof division === 'string' ? division.trim() : '';
    const cleanDistrict = typeof district === 'string' ? district.trim() : '';
    const cleanAddress = typeof address === 'string' ? address.trim() : '';

    if (!cleanDivision || !cleanDistrict) {
      res.status(400).json({ error: 'অনুগ্রহ করে বিভাগ এবং জেলা নির্বাচন করুন।' });
      return;
    }
    if (cleanAddress.length < 5 || cleanAddress.length > 400) {
      res.status(400).json({ error: 'অনুগ্রহ করে সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন।' });
      return;
    }

    if (deliveryArea !== 'inside_dhaka' && deliveryArea !== 'outside_dhaka') {
      res.status(400).json({ error: 'ডেলিভারি এলাকা নির্বাচন করুন।' });
      return;
    }

    const cleanRequestId =
      typeof clientRequestId === 'string' && clientRequestId.trim().length > 0
        ? clientRequestId.trim().slice(0, 64)
        : null;

    const created = await runInTransaction(async (tx) => {
      if (cleanRequestId) {
        const existing = await tx.queryOne<Record<string, unknown>>(
          'SELECT * FROM orders WHERE client_request_id = ?',
          [cleanRequestId]
        );
        if (existing) {
          const hydrated = await hydrateOrders([existing], tx);
          return hydrated[0];
        }
      }

      // Dialect-agnostic 15-second duplicate order guard
      const latestMatch = await tx.queryOne<{ created_at: string }>(
        `SELECT o.created_at FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.customer_phone = ? AND oi.product_id = ?
         ORDER BY o.id DESC
         LIMIT 1`,
        [cleanPhone, parsedProductId]
      );
      if (latestMatch?.created_at) {
        const ts = new Date(latestMatch.created_at).getTime();
        if (Number.isFinite(ts) && Date.now() - ts < 15000) {
          throw new Error('DUPLICATE_RECENT');
        }
      }

      const product = await tx.queryOne<{
        id: number;
        name: string;
        regular_price: number;
        discount_price: number | null;
        stock: number;
      }>("SELECT id, name, regular_price, discount_price, stock FROM products WHERE id = ? AND status = 'active'", [
        parsedProductId,
      ]);

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const availableStock = Number(product.stock);
      if (availableStock < parsedQuantity) {
        throw new Error(`INSUFFICIENT_STOCK:${availableStock}`);
      }

      const regPrice = Number(product.regular_price);
      const discPrice = product.discount_price !== null ? Number(product.discount_price) : null;
      const unitPrice = discPrice !== null && discPrice > 0 && discPrice < regPrice ? discPrice : regPrice;

      const settings = await getSettingsObject(tx);
      const deliveryCharge =
        deliveryArea === 'inside_dhaka'
          ? Number(settings.delivery_inside_dhaka)
          : Number(settings.delivery_outside_dhaka);

      const subtotal = unitPrice * parsedQuantity;
      const totalAmount = subtotal + deliveryCharge;

      const randomCode = crypto.randomInt(1000, 9999);
      const dateTag = new Date().toISOString().slice(2, 7).replace('-', '');
      const orderCode = `SH-${dateTag}-${randomCode}-${crypto.randomInt(10, 99)}`;

      const firstImgRow = await tx.queryOne<{ image_url: string }>(
        'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1',
        [product.id]
      );

      const nowIso = new Date().toISOString();
      const orderId = await tx.insert(
        `INSERT INTO orders (
          order_code, customer_name, customer_phone, division, district, address,
          delivery_area, delivery_charge, subtotal, total_amount, payment_method, status, client_request_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderCode,
          cleanName,
          cleanPhone,
          cleanDivision,
          cleanDistrict,
          cleanAddress,
          deliveryArea,
          deliveryCharge,
          subtotal,
          totalAmount,
          'ক্যাশ অন ডেলিভারি',
          'অর্ডার গ্রহণ করা হয়েছে।',
          cleanRequestId,
          nowIso,
          nowIso,
        ]
      );

      await tx.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, product.id, product.name, firstImgRow?.image_url || '', unitPrice, parsedQuantity, subtotal]
      );

      await tx.execute('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?', [
        parsedQuantity,
        nowIso,
        product.id,
      ]);

      const createdOrder = await tx.queryOne<Record<string, unknown>>('SELECT * FROM orders WHERE id = ?', [
        orderId,
      ]);
      const hydrated = await hydrateOrders(createdOrder ? [createdOrder] : [], tx);
      return hydrated[0];
    });

    res.status(201).json({
      message: 'আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। আমাদের পক্ষ থেকে শীঘ্রই আপনার সাথে যোগাযোগ করা হবে।',
      order: created,
    });
  } catch (error: any) {
    if (error?.message === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ error: 'পণ্যটি বর্তমানে অর্ডারের জন্য উপলব্ধ নয়।' });
      return;
    }
    if (error?.message === 'DUPLICATE_RECENT') {
      res.status(429).json({ error: 'একই অর্ডার কিছুক্ষণ আগে গ্রহণ করা হয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।' });
      return;
    }
    if (typeof error?.message === 'string' && error.message.startsWith('INSUFFICIENT_STOCK:')) {
      const available = error.message.split(':')[1];
      res.status(409).json({ error: `দুঃখিত, এই পণ্যটির স্টক পর্যাপ্ত নেই (বর্তমান স্টক: ${available})।` });
      return;
    }
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'অর্ডার প্রক্রিয়াকরণে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' });
  }
});

// Public Order Tracking (requires BOTH Order ID and Phone Number)
app.get('/api/orders/track', async (req, res) => {
  try {
    const orderCode = typeof req.query.orderCode === 'string' ? req.query.orderCode.trim().toUpperCase() : '';
    const phone = normalizePhone(typeof req.query.phone === 'string' ? req.query.phone : '');

    if (!orderCode || !phone) {
      res.status(400).json({ error: 'অর্ডার আইডি এবং মোবাইল নম্বর—উভয়ই প্রদান করুন।' });
      return;
    }

    const db = await getDb();
    const row = await db.queryOne<Record<string, unknown>>(
      'SELECT * FROM orders WHERE UPPER(order_code) = ? AND customer_phone = ?',
      [orderCode, phone]
    );

    if (!row) {
      res.status(404).json({ error: 'প্রদত্ত অর্ডার আইডি ও মোবাইল নম্বরের সাথে মিলে যাওয়া কোনো অর্ডার পাওয়া যায়নি।' });
      return;
    }

    const hydrated = await hydrateOrders([row], db);
    res.json(hydrated[0]);
  } catch {
    res.status(500).json({ error: 'অর্ডার অনুসন্ধানে সমস্যা হয়েছে।' });
  }
});

// ==========================================
// ADMIN AUTHENTICATION ENDPOINTS
// ==========================================

app.get('/api/admin/auth/status', async (req, res) => {
  try {
    const envConfigured = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
    const db = await getDb();
    const countRow = await db.queryOne<{ count: number | string }>('SELECT COUNT(*) as count FROM admin_users');
    const adminCount = Number(countRow?.count ?? 0);
    const needsSetup = !envConfigured && adminCount === 0;

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const verified = token ? await verifyAdminToken(token) : null;

    res.json({
      needsSetup,
      authenticated: Boolean(verified),
      username: verified?.username || null,
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'অথেনটিকেশন অবস্থা যাচাই করা যায়নি।' });
  }
});

app.post('/api/admin/auth/setup', async (req, res) => {
  try {
    const envConfigured = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
    if (envConfigured) {
      res.status(403).json({ error: 'পরিবেশ ভ্যারিয়েবলের মাধ্যমে অ্যাডমিন অ্যাকাউন্ট ইতিমধ্যে নির্ধারিত আছে।' });
      return;
    }

    const { username, password } = req.body ?? {};
    const cleanUsername = typeof username === 'string' ? username.trim() : '';
    const cleanPassword = typeof password === 'string' ? password : '';

    if (cleanUsername.length < 3 || cleanUsername.length > 40) {
      res.status(400).json({ error: 'ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে।' });
      return;
    }
    if (cleanPassword.length < 6 || cleanPassword.length > 100) {
      res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
      return;
    }

    await runInTransaction(async (tx) => {
      const countRow = await tx.queryOne<{ count: number | string }>('SELECT COUNT(*) as count FROM admin_users');
      if (Number(countRow?.count ?? 0) > 0) {
        throw new Error('ALREADY_SETUP');
      }
      const { hash, salt } = hashPassword(cleanPassword);
      await tx.execute('INSERT INTO admin_users (username, password_hash, salt) VALUES (?, ?, ?)', [
        cleanUsername,
        hash,
        salt,
      ]);
    });

    const token = await signAdminToken(cleanUsername);
    res.status(201).json({ token, username: cleanUsername });
  } catch (error: any) {
    if (error?.message === 'ALREADY_SETUP') {
      res.status(403).json({ error: 'অ্যাডমিন অ্যাকাউন্ট ইতিমধ্যে তৈরি করা হয়েছে। অনুগ্রহ করে লগইন করুন।' });
      return;
    }
    console.error('Admin setup error:', error);
    res.status(500).json({ error: 'অ্যাডমিন অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে।' });
  }
});

const loginRateLimits = new Map<string, { count: number; resetAt: number }>();

app.post('/api/admin/auth/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = loginRateLimits.get(clientIp);
    if (record && now < record.resetAt && record.count >= 10) {
      res.status(429).json({
        error: 'অতিরিক্ত ভুল চেষ্টার কারণে সাময়িকভাবে লগইন ব্লক করা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।',
      });
      return;
    }

    const { username, password } = req.body ?? {};
    const cleanUsername = typeof username === 'string' ? username.trim() : '';
    const cleanPassword = typeof password === 'string' ? password : '';

    if (!cleanUsername || !cleanPassword) {
      res.status(400).json({ error: 'ইউজারনেম এবং পাসওয়ার্ড দিন।' });
      return;
    }

    const recordFailedAttempt = () => {
      const current = loginRateLimits.get(clientIp);
      if (!current || now >= current.resetAt) {
        loginRateLimits.set(clientIp, { count: 1, resetAt: now + 15 * 60 * 1000 });
      } else {
        current.count += 1;
      }
    };

    const envPass = process.env.ADMIN_PASSWORD;
    const envUser = process.env.ADMIN_USERNAME || 'admin';
    if (envPass && envPass.trim().length > 0) {
      const userMatches = cleanUsername === envUser;
      const passBuf = Buffer.from(cleanPassword);
      const envBuf = Buffer.from(envPass);
      const passMatches = passBuf.length === envBuf.length && crypto.timingSafeEqual(passBuf, envBuf);

      if (userMatches && passMatches) {
        loginRateLimits.delete(clientIp);
        const token = await signAdminToken(cleanUsername);
        res.json({ token, username: cleanUsername });
        return;
      }
      recordFailedAttempt();
      res.status(401).json({ error: 'ভুল ইউজারনেম অথবা পাসওয়ার্ড।' });
      return;
    }

    const db = await getDb();
    const admin = await db.queryOne<{
      id: number;
      username: string;
      password_hash: string;
      salt: string;
    }>('SELECT id, username, password_hash, salt FROM admin_users WHERE username = ?', [cleanUsername]);

    if (!admin || !verifyPassword(cleanPassword, admin.password_hash, admin.salt)) {
      recordFailedAttempt();
      res.status(401).json({ error: 'ভুল ইউজারনেম অথবা পাসওয়ার্ড।' });
      return;
    }

    loginRateLimits.delete(clientIp);
    const token = await signAdminToken(admin.username);
    res.json({ token, username: admin.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'লগইন করতে সমস্যা হয়েছে।' });
  }
});

app.post('/api/admin/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const verified = await verifyAdminToken(token);
      if (verified) {
        const db = await getDb();
        await db.execute(
          'INSERT INTO revoked_tokens (jti, exp) VALUES (?, ?) ON CONFLICT(jti) DO NOTHING',
          [verified.jti, verified.exp]
        );
        await db.execute('DELETE FROM revoked_tokens WHERE exp < ?', [Date.now()]);
      }
    }
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

// ==========================================
// PROTECTED ADMIN API ENDPOINTS
// ==========================================

app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();
    const totalOrders = Number(
      (await db.queryOne<{ c: number | string }>('SELECT COUNT(*) as c FROM orders'))?.c ?? 0
    );
    const pendingOrders = Number(
      (
        await db.queryOne<{ c: number | string }>(
          "SELECT COUNT(*) as c FROM orders WHERE status IN ('অর্ডার গ্রহণ করা হয়েছে।', 'অর্ডার নিশ্চিত করা হয়েছে।', 'পণ্য পাঠানো হয়েছে।')"
        )
      )?.c ?? 0
    );
    const completedOrders = Number(
      (
        await db.queryOne<{ c: number | string }>(
          "SELECT COUNT(*) as c FROM orders WHERE status = 'ডেলিভারি সম্পন্ন হয়েছে।'"
        )
      )?.c ?? 0
    );
    const cancelledOrders = Number(
      (
        await db.queryOne<{ c: number | string }>(
          "SELECT COUNT(*) as c FROM orders WHERE status = 'অর্ডার বাতিল হয়েছে।'"
        )
      )?.c ?? 0
    );
    const totalProducts = Number(
      (await db.queryOne<{ c: number | string }>('SELECT COUNT(*) as c FROM products'))?.c ?? 0
    );
    const totalSalesRow = await db.queryOne<{ sum: number | string }>(
      "SELECT COALESCE(SUM(total_amount), 0) as sum FROM orders WHERE status != 'অর্ডার বাতিল হয়েছে।'"
    );

    const recentRows = await db.queryAll<Record<string, unknown>>(
      'SELECT * FROM orders ORDER BY id DESC LIMIT 6'
    );

    res.json({
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalProducts,
      totalSales: Number(totalSalesRow?.sum ?? 0),
      recentOrders: await hydrateOrders(recentRows, db),
    });
  } catch (error) {
    console.error('Overview error:', error);
    res.status(500).json({ error: 'ড্যাশবোর্ড তথ্য লোড করা যায়নি।' });
  }
});

// Upload image endpoint (persists in database so Vercel & local work identically)
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'ছবি আপলোড ব্যর্থ হয়েছে।' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'কোনো ছবি নির্বাচন করা হয়নি।' });
      return;
    }
    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      const fileId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
      const base64 = req.file.buffer.toString('base64');
      const db = await getDb();
      await db.execute(
        'INSERT INTO uploaded_files (id, mime_type, data_base64) VALUES (?, ?, ?)',
        [fileId, req.file.mimetype, base64]
      );
      res.status(201).json({ url: `/api/files/${fileId}` });
    } catch (uploadErr) {
      console.error('Upload save error:', uploadErr);
      res.status(500).json({ error: 'ছবি সংরক্ষণ করতে সমস্যা হয়েছে।' });
    }
  });
});

// Admin Products CRUD
app.get('/api/admin/products', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();
    const rows = await db.queryAll<Record<string, unknown>>(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.id DESC`
    );
    res.json(await hydrateProducts(rows, db));
  } catch {
    res.status(500).json({ error: 'পণ্য তালিকা লোড করতে সমস্যা হয়েছে।' });
  }
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      category_id,
      regular_price,
      discount_price,
      description,
      stock,
      status,
      is_featured,
      is_popular,
      images,
    } = req.body ?? {};

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const regPrice = Number(regular_price);
    const discPrice =
      discount_price !== null && discount_price !== '' && discount_price !== undefined
        ? Number(discount_price)
        : null;
    const parsedStock = Number(stock);

    if (cleanName.length < 2) {
      res.status(400).json({ error: 'পণ্যের নাম লিখুন।' });
      return;
    }
    if (!Number.isFinite(regPrice) || regPrice <= 0) {
      res.status(400).json({ error: 'সঠিক রেগুলার মূল্য দিন।' });
      return;
    }
    if (discPrice !== null && (!Number.isFinite(discPrice) || discPrice < 0 || discPrice >= regPrice)) {
      res.status(400).json({ error: 'ডিসকাউন্ট মূল্য রেগুলার মূল্যের চেয়ে কম হতে হবে।' });
      return;
    }
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      res.status(400).json({ error: 'সঠিক স্টক সংখ্যা দিন।' });
      return;
    }

    const cleanStatus = status === 'inactive' ? 'inactive' : 'active';
    const catId = category_id ? Number(category_id) : null;
    const cleanDesc = typeof description === 'string' ? description.trim() : '';
    const cleanImages = Array.isArray(images)
      ? images.map((u) => sanitizeImageUrl(String(u))).filter(Boolean)
      : [];

    const created = await runInTransaction(async (tx) => {
      const nowIso = new Date().toISOString();
      const productId = await tx.insert(
        `INSERT INTO products (name, slug, category_id, regular_price, discount_price, description, stock, status, is_featured, is_popular, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cleanName,
          makeSlug(cleanName),
          catId,
          regPrice,
          discPrice,
          cleanDesc,
          parsedStock,
          cleanStatus,
          is_featured ? 1 : 0,
          is_popular ? 1 : 0,
          nowIso,
          nowIso,
        ]
      );

      for (let idx = 0; idx < cleanImages.length; idx++) {
        await tx.execute(
          'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)',
          [productId, cleanImages[idx], idx]
        );
      }

      const row = await tx.queryOne<Record<string, unknown>>(
        'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
        [productId]
      );
      const hydrated = await hydrateProducts(row ? [row] : [], tx);
      return hydrated[0];
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'পণ্য সংরক্ষণ করতে সমস্যা হয়েছে।' });
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'অবৈধ পণ্য আইডি।' });
      return;
    }

    const db = await getDb();
    const existing = await db.queryOne('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'পণ্যটি পাওয়া যায়নি।' });
      return;
    }

    const {
      name,
      category_id,
      regular_price,
      discount_price,
      description,
      stock,
      status,
      is_featured,
      is_popular,
      images,
    } = req.body ?? {};

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const regPrice = Number(regular_price);
    const discPrice =
      discount_price !== null && discount_price !== '' && discount_price !== undefined
        ? Number(discount_price)
        : null;
    const parsedStock = Number(stock);

    if (
      cleanName.length < 2 ||
      !Number.isFinite(regPrice) ||
      regPrice <= 0 ||
      !Number.isInteger(parsedStock) ||
      parsedStock < 0
    ) {
      res.status(400).json({ error: 'পণ্যের সঠিক তথ্য প্রদান করুন।' });
      return;
    }
    if (discPrice !== null && (!Number.isFinite(discPrice) || discPrice < 0 || discPrice >= regPrice)) {
      res.status(400).json({ error: 'ডিসকাউন্ট মূল্য রেগুলার মূল্যের চেয়ে কম হতে হবে।' });
      return;
    }

    const cleanStatus = status === 'inactive' ? 'inactive' : 'active';
    const catId = category_id ? Number(category_id) : null;
    const cleanDesc = typeof description === 'string' ? description.trim() : '';
    const cleanImages = Array.isArray(images)
      ? images.map((u) => sanitizeImageUrl(String(u))).filter(Boolean)
      : null;

    const updated = await runInTransaction(async (tx) => {
      await tx.execute(
        `UPDATE products
         SET name = ?, category_id = ?, regular_price = ?, discount_price = ?,
             description = ?, stock = ?, status = ?, is_featured = ?, is_popular = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          cleanName,
          catId,
          regPrice,
          discPrice,
          cleanDesc,
          parsedStock,
          cleanStatus,
          is_featured ? 1 : 0,
          is_popular ? 1 : 0,
          new Date().toISOString(),
          id,
        ]
      );

      if (cleanImages !== null) {
        await tx.execute('DELETE FROM product_images WHERE product_id = ?', [id]);
        for (let idx = 0; idx < cleanImages.length; idx++) {
          await tx.execute(
            'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)',
            [id, cleanImages[idx], idx]
          );
        }
      }

      const row = await tx.queryOne<Record<string, unknown>>(
        'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
        [id]
      );
      const hydrated = await hydrateProducts(row ? [row] : [], tx);
      return hydrated[0];
    });

    res.json(updated);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'পণ্য আপডেট করতে সমস্যা হয়েছে।' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'অবৈধ পণ্য আইডি।' });
    return;
  }
  const db = await getDb();
  await db.execute('DELETE FROM products WHERE id = ?', [id]);
  res.json({ success: true });
});

// Admin Categories CRUD
app.get('/api/admin/categories', requireAdmin, async (_req, res) => {
  const db = await getDb();
  const rows = await db.queryAll<any>(
    `SELECT c.*, COUNT(p.id) as product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.id ASC`
  );
  res.json(
    rows.map((c) => ({
      ...c,
      id: Number(c.id),
      sort_order: Number(c.sort_order),
      product_count: Number(c.product_count ?? 0),
    }))
  );
});

app.post('/api/admin/categories', requireAdmin, async (req, res) => {
  const { name, description, sort_order } = req.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < 2) {
    res.status(400).json({ error: 'ক্যাটাগরির নাম লিখুন।' });
    return;
  }
  const db = await getDb();
  const id = await db.insert(
    'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)',
    [cleanName, makeSlug(cleanName), typeof description === 'string' ? description.trim() : '', Number(sort_order) || 0]
  );
  const created = await db.queryOne('SELECT * FROM categories WHERE id = ?', [id]);
  res.status(201).json(created);
});

app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, sort_order } = req.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!Number.isInteger(id) || cleanName.length < 2) {
    res.status(400).json({ error: 'সঠিক ক্যাটাগরির তথ্য দিন।' });
    return;
  }
  const db = await getDb();
  await db.execute('UPDATE categories SET name = ?, description = ?, sort_order = ? WHERE id = ?', [
    cleanName,
    typeof description === 'string' ? description.trim() : '',
    Number(sort_order) || 0,
    id,
  ]);
  const updated = await db.queryOne('SELECT * FROM categories WHERE id = ?', [id]);
  res.json(updated);
});

app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'অবৈধ ক্যাটাগরি।' });
    return;
  }
  const db = await getDb();
  await db.execute('DELETE FROM categories WHERE id = ?', [id]);
  res.json({ success: true });
});

// Admin Orders Management
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push(
        '(LOWER(order_code) LIKE LOWER(?) OR LOWER(customer_name) LIKE LOWER(?) OR customer_phone LIKE ?)'
      );
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }
    if (dateFrom) {
      if (db.dialect === 'postgres') {
        conditions.push('created_at::date >= ?::date');
      } else {
        conditions.push('date(created_at) >= date(?)');
      }
      params.push(dateFrom);
    }
    if (dateTo) {
      if (db.dialect === 'postgres') {
        conditions.push('created_at::date <= ?::date');
      } else {
        conditions.push('date(created_at) <= date(?)');
      }
      params.push(dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.queryAll<Record<string, unknown>>(
      `SELECT * FROM orders ${where} ORDER BY id DESC`,
      params
    );

    res.json(await hydrateOrders(rows, db));
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ error: 'অর্ডার তালিকা লোড করতে সমস্যা হয়েছে।' });
  }
});

app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body ?? {};
    if (!Number.isInteger(id) || !ALLOWED_ORDER_STATUSES.includes(status)) {
      res.status(400).json({ error: 'অবৈধ অর্ডার স্ট্যাটাস।' });
      return;
    }

    const updatedOrder = await runInTransaction(async (tx) => {
      const order = await tx.queryOne<{ id: number; status: string }>(
        'SELECT id, status FROM orders WHERE id = ?',
        [id]
      );
      if (!order) {
        throw new Error('NOT_FOUND');
      }

      const cancelledStatus = 'অর্ডার বাতিল হয়েছে।';
      if (order.status !== cancelledStatus && status === cancelledStatus) {
        const items = await tx.queryAll<{ product_id: number; quantity: number }>(
          'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
          [id]
        );
        for (const item of items) {
          await tx.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [
            Number(item.quantity),
            Number(item.product_id),
          ]);
        }
      } else if (order.status === cancelledStatus && status !== cancelledStatus) {
        const items = await tx.queryAll<{ product_id: number; quantity: number }>(
          'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
          [id]
        );
        for (const item of items) {
          const qty = Number(item.quantity);
          await tx.execute(
            'UPDATE products SET stock = CASE WHEN stock - ? < 0 THEN 0 ELSE stock - ? END WHERE id = ?',
            [qty, qty, Number(item.product_id)]
          );
        }
      }

      await tx.execute('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [
        status,
        new Date().toISOString(),
        id,
      ]);
      const updated = await tx.queryOne<Record<string, unknown>>('SELECT * FROM orders WHERE id = ?', [id]);
      const hydrated = await hydrateOrders(updated ? [updated] : [], tx);
      return hydrated[0];
    });

    res.json(updatedOrder);
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'অর্ডারটি পাওয়া যায়নি।' });
      return;
    }
    res.status(500).json({ error: 'অর্ডার স্ট্যাটাস আপডেট করা যায়নি।' });
  }
});

app.delete('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    if (req.body?.confirmDeleteAll !== true) {
      res.status(400).json({ error: 'সব অর্ডার মুছে ফেলার জন্য নিশ্চিতকরণ প্রয়োজন।' });
      return;
    }

    const deletedCount = await runInTransaction(async (tx) => {
      await tx.execute('DELETE FROM order_items');
      const result = await tx.execute('DELETE FROM orders');
      return result.changes;
    });

    res.json({
      success: true,
      deletedCount,
      message: 'সকল অর্ডার ও বিক্রির হিসাব সফলভাবে মুছে ফেলা হয়েছে।',
    });
  } catch (error) {
    console.error('Delete all orders error:', error);
    res.status(500).json({ error: 'সব অর্ডার মুছে ফেলতে সমস্যা হয়েছে।' });
  }
});

// Admin Banners CRUD
app.get('/api/admin/banners', requireAdmin, async (_req, res) => {
  const db = await getDb();
  const rows = await db.queryAll<any>('SELECT * FROM banners ORDER BY sort_order ASC, id ASC');
  res.json(rows.map((b) => ({ ...b, id: Number(b.id), is_active: Boolean(Number(b.is_active)) })));
});

app.post('/api/admin/banners', requireAdmin, async (req, res) => {
  const { title, subtitle, cta_text, cta_link, image_url, is_active, sort_order } = req.body ?? {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanImage = sanitizeImageUrl(typeof image_url === 'string' ? image_url : '');
  if (cleanTitle.length < 2 || !cleanImage) {
    res.status(400).json({ error: 'ব্যানারের শিরোনাম ও ছবি প্রদান করুন।' });
    return;
  }

  const db = await getDb();
  const id = await db.insert(
    'INSERT INTO banners (title, subtitle, cta_text, cta_link, image_url, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      cleanTitle,
      typeof subtitle === 'string' ? subtitle.trim() : '',
      typeof cta_text === 'string' && cta_text.trim() ? cta_text.trim() : 'এখনই দেখুন',
      typeof cta_link === 'string' && cta_link.trim() ? cta_link.trim() : '#catalog',
      cleanImage,
      is_active === false ? 0 : 1,
      Number(sort_order) || 0,
    ]
  );

  const created = await db.queryOne<any>('SELECT * FROM banners WHERE id = ?', [id]);
  res.status(201).json({ ...created, id: Number(created.id), is_active: Boolean(Number(created.is_active)) });
});

app.put('/api/admin/banners/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { title, subtitle, cta_text, cta_link, image_url, is_active, sort_order } = req.body ?? {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanImage = sanitizeImageUrl(typeof image_url === 'string' ? image_url : '');
  if (!Number.isInteger(id) || cleanTitle.length < 2 || !cleanImage) {
    res.status(400).json({ error: 'ব্যানারের সঠিক তথ্য প্রদান করুন।' });
    return;
  }

  const db = await getDb();
  await db.execute(
    'UPDATE banners SET title = ?, subtitle = ?, cta_text = ?, cta_link = ?, image_url = ?, is_active = ?, sort_order = ? WHERE id = ?',
    [
      cleanTitle,
      typeof subtitle === 'string' ? subtitle.trim() : '',
      typeof cta_text === 'string' && cta_text.trim() ? cta_text.trim() : 'এখনই দেখুন',
      typeof cta_link === 'string' && cta_link.trim() ? cta_link.trim() : '#catalog',
      cleanImage,
      is_active === false ? 0 : 1,
      Number(sort_order) || 0,
      id,
    ]
  );

  const updated = await db.queryOne<any>('SELECT * FROM banners WHERE id = ?', [id]);
  res.json({ ...updated, id: Number(updated.id), is_active: Boolean(Number(updated.is_active)) });
});

app.delete('/api/admin/banners/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const db = await getDb();
  await db.execute('DELETE FROM banners WHERE id = ?', [id]);
  res.json({ success: true });
});

// Admin Reviews Management
app.get('/api/admin/reviews', requireAdmin, async (_req, res) => {
  const db = await getDb();
  const rows = await db.queryAll<any>('SELECT * FROM reviews ORDER BY id DESC');
  res.json(rows.map((r) => ({ ...r, id: Number(r.id), is_active: Boolean(Number(r.is_active)) })));
});

app.post('/api/admin/reviews', requireAdmin, async (req, res) => {
  const { customer_name, location, rating, comment, product_name } = req.body ?? {};
  if (!customer_name || !comment) {
    res.status(400).json({ error: 'গ্রাহকের নাম এবং মতামত লিখুন।' });
    return;
  }
  const db = await getDb();
  const id = await db.insert(
    'INSERT INTO reviews (customer_name, location, rating, comment, product_name) VALUES (?, ?, ?, ?, ?)',
    [
      String(customer_name).trim(),
      String(location || 'বাংলাদেশ').trim(),
      Math.min(5, Math.max(1, Number(rating) || 5)),
      String(comment).trim(),
      String(product_name || '').trim(),
    ]
  );
  const created = await db.queryOne<any>('SELECT * FROM reviews WHERE id = ?', [id]);
  res.status(201).json({ ...created, id: Number(created.id), is_active: Boolean(Number(created.is_active)) });
});

app.delete('/api/admin/reviews/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const db = await getDb();
  await db.execute('DELETE FROM reviews WHERE id = ?', [id]);
  res.json({ success: true });
});

// Admin Website & Delivery Settings
app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
  res.json(await getSettingsObject());
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const incoming = req.body ?? {};
    const allowedKeys = [
      'website_name',
      'website_logo',
      'primary_color',
      'secondary_color',
      'button_color',
      'delivery_inside_dhaka',
      'delivery_outside_dhaka',
      'contact_phone',
      'contact_email',
      'contact_address',
      'contact_hours',
      'social_facebook',
      'social_instagram',
      'social_youtube',
      'social_whatsapp',
      'footer_about',
      'footer_copyright',
      'welcome_title',
      'welcome_message',
      'special_offer_title',
      'special_offer_subtitle',
      'special_offer_highlight',
      'show_banners',
      'show_categories',
      'show_featured',
      'show_latest',
      'show_popular',
      'show_special_offers',
      'show_reviews',
      'show_contact',
      'section_title_featured',
      'section_title_latest',
      'section_title_popular',
      'section_title_reviews',
    ];

    await runInTransaction(async (tx) => {
      for (const key of allowedKeys) {
        if (incoming[key] !== undefined) {
          let val = incoming[key];
          if (key === 'delivery_inside_dhaka' || key === 'delivery_outside_dhaka') {
            const num = Number(val);
            if (!Number.isFinite(num) || num < 0) {
              throw new Error('INVALID_DELIVERY_CHARGE');
            }
            val = String(Math.round(num));
          } else if (key === 'website_logo') {
            val = val ? sanitizeImageUrl(String(val)) : '';
          } else if (key.endsWith('_color')) {
            const colorStr = String(val).trim();
            if (!/^#[0-9a-fA-F]{6}$/.test(colorStr)) {
              throw new Error('INVALID_COLOR');
            }
            val = colorStr;
          } else if (key.startsWith('show_')) {
            val = Boolean(val) ? 'true' : 'false';
          } else {
            val = String(val).trim();
          }
          await tx.execute(
            'INSERT INTO website_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            [key, val]
          );
        }
      }
    });

    res.json(await getSettingsObject());
  } catch (error: any) {
    if (error?.message === 'INVALID_DELIVERY_CHARGE') {
      res.status(400).json({ error: 'ডেলিভারি চার্জ ০ বা তার বেশি সংখ্যা হতে হবে।' });
      return;
    }
    if (error?.message === 'INVALID_COLOR') {
      res.status(400).json({ error: 'সঠিক হেক্স কালার কোড দিন (যেমন #0F5132)।' });
      return;
    }
    res.status(500).json({ error: 'সেটিংস সংরক্ষণ করা যায়নি।' });
  }
});
