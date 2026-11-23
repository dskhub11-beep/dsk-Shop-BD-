import express, { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db, hashPassword, initializeDatabase, verifyPassword } from './server/db.ts';

dotenv.config();

initializeDatabase();

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const ALLOWED_ORDER_STATUSES = [
  'অর্ডার গ্রহণ করা হয়েছে।',
  'অর্ডার নিশ্চিত করা হয়েছে।',
  'পণ্য পাঠানো হয়েছে।',
  'ডেলিভারি সম্পন্ন হয়েছে।',
  'অর্ডার বাতিল হয়েছে।',
] as const;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Safe static upload serving with confinement
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false }), (_err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ error: 'ফাইল পাওয়া যায়নি' });
});

// Configure Multer for secure image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
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

// Token signing & verification with revocation support
interface TokenPayload {
  jti: string;
  username: string;
  exp: number;
}

function signAdminToken(username: string): string {
  const payload: TokenPayload = {
    jti: crypto.randomBytes(16).toString('hex'),
    username,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyAdminToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.jti || !payload.username || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    const revoked = db.prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?').get(payload.jti);
    if (revoked) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'অনুমোদন প্রয়োজন। অনুগ্রহ করে অ্যাডমিন লগইন করুন।' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const verified = verifyAdminToken(token);
  if (!verified) {
    res.status(401).json({ error: 'সেশন মেয়াদোত্তীর্ণ হয়েছে। পুনরায় লগইন করুন।' });
    return;
  }
  (req as Request & { adminUser?: string }).adminUser = verified.username;
  next();
}

function getSettingsObject(): Record<string, unknown> {
  const rows = db.prepare('SELECT key, value FROM website_settings').all() as Array<{ key: string; value: string }>;
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

function hydrateProducts(rows: Array<Record<string, unknown>>) {
  const getImages = db.prepare(
    'SELECT id, product_id, image_url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC'
  );
  return rows.map((row) => ({
    ...row,
    is_featured: Boolean(row.is_featured),
    is_popular: Boolean(row.is_popular),
    category_name: (row.category_name as string) || 'সাধারণ',
    images: getImages.all(row.id as number),
  }));
}

function hydrateOrders(rows: Array<Record<string, unknown>>) {
  const getItems = db.prepare(
    'SELECT id, order_id, product_id, product_name, product_image, unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id ASC'
  );
  return rows.map((row) => ({
    ...row,
    items: getItems.all(row.id as number),
  }));
}

function normalizePhone(input: string): string {
  // Convert Bengali digits to ASCII and strip spaces/dashes
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
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/src/assets/')) {
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

app.get('/api/storefront', (_req, res) => {
  try {
    const settings = getSettingsObject();
    const banners = db
      .prepare('SELECT id, title, subtitle, cta_text, cta_link, image_url, is_active, sort_order FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
      .all()
      .map((b: any) => ({ ...b, is_active: Boolean(b.is_active) }));

    const categories = db
      .prepare(
        `SELECT c.id, c.name, c.slug, c.description, c.sort_order,
                COUNT(p.id) as product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
         GROUP BY c.id
         ORDER BY c.sort_order ASC, c.id ASC`
      )
      .all();

    const productRows = db
      .prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.status = 'active'
         ORDER BY p.created_at DESC, p.id DESC`
      )
      .all() as Array<Record<string, unknown>>;

    const reviews = db
      .prepare('SELECT id, customer_name, location, rating, comment, product_name, is_active, created_at FROM reviews WHERE is_active = 1 ORDER BY id DESC')
      .all()
      .map((r: any) => ({ ...r, is_active: Boolean(r.is_active) }));

    res.json({
      settings,
      banners,
      categories,
      products: hydrateProducts(productRows),
      reviews,
    });
  } catch (error) {
    console.error('Storefront fetch error:', error);
    res.status(500).json({ error: 'তথ্য লোড করতে সমস্যা হয়েছে।' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'সঠিক পণ্য আইডি দিন।' });
      return;
    }
    const row = db
      .prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ? AND p.status = 'active'`
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: 'পণ্যটি পাওয়া যায়নি।' });
      return;
    }
    res.json(hydrateProducts([row])[0]);
  } catch {
    res.status(500).json({ error: 'পণ্যের তথ্য পাওয়া যায়নি।' });
  }
});

// Direct Order Creation (NO cart, NO customer login)
app.post('/api/orders', (req, res) => {
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

    const createOrderTx = db.transaction(() => {
      // Idempotency check if clientRequestId was provided
      if (cleanRequestId) {
        const existing = db
          .prepare('SELECT * FROM orders WHERE client_request_id = ?')
          .get(cleanRequestId) as Record<string, unknown> | undefined;
        if (existing) {
          return hydrateOrders([existing])[0];
        }
      }

      // Prevent accidental double submission within 15 seconds for same phone + product
      const recentDup = db
        .prepare(
          `SELECT o.* FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           WHERE o.customer_phone = ? AND oi.product_id = ?
             AND datetime(o.created_at) >= datetime('now', '-15 seconds')
           LIMIT 1`
        )
        .get(cleanPhone, parsedProductId) as Record<string, unknown> | undefined;

      if (recentDup) {
        throw new Error('DUPLICATE_RECENT');
      }

      const product = db
        .prepare("SELECT * FROM products WHERE id = ? AND status = 'active'")
        .get(parsedProductId) as
        | {
            id: number;
            name: string;
            regular_price: number;
            discount_price: number | null;
            stock: number;
          }
        | undefined;

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      if (product.stock < parsedQuantity) {
        throw new Error(`INSUFFICIENT_STOCK:${product.stock}`);
      }

      const unitPrice =
        product.discount_price !== null &&
        product.discount_price > 0 &&
        product.discount_price < product.regular_price
          ? product.discount_price
          : product.regular_price;

      const settings = getSettingsObject();
      const deliveryCharge =
        deliveryArea === 'inside_dhaka'
          ? Number(settings.delivery_inside_dhaka)
          : Number(settings.delivery_outside_dhaka);

      const subtotal = unitPrice * parsedQuantity;
      const totalAmount = subtotal + deliveryCharge;

      const randomCode = crypto.randomInt(1000, 9999);
      const dateTag = new Date().toISOString().slice(2, 7).replace('-', '');
      const orderCode = `SH-${dateTag}-${randomCode}-${crypto.randomInt(10, 99)}`;

      const firstImgRow = db
        .prepare('SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1')
        .get(product.id) as { image_url: string } | undefined;

      const orderInfo = db
        .prepare(
          `INSERT INTO orders (
            order_code, customer_name, customer_phone, division, district, address,
            delivery_area, delivery_charge, subtotal, total_amount, payment_method, status, client_request_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
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
          cleanRequestId
        );

      const orderId = Number(orderInfo.lastInsertRowid);

      db.prepare(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        orderId,
        product.id,
        product.name,
        firstImgRow?.image_url || '',
        unitPrice,
        parsedQuantity,
        subtotal
      );

      db.prepare("UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?").run(
        parsedQuantity,
        product.id
      );

      const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;
      return hydrateOrders([createdOrder])[0];
    });

    const created = createOrderTx();
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
app.get('/api/orders/track', (req, res) => {
  try {
    const orderCode = typeof req.query.orderCode === 'string' ? req.query.orderCode.trim().toUpperCase() : '';
    const phone = normalizePhone(typeof req.query.phone === 'string' ? req.query.phone : '');

    if (!orderCode || !phone) {
      res.status(400).json({ error: 'অর্ডার আইডি এবং মোবাইল নম্বর—উভয়ই প্রদান করুন।' });
      return;
    }

    const row = db
      .prepare('SELECT * FROM orders WHERE UPPER(order_code) = ? AND customer_phone = ?')
      .get(orderCode, phone) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: 'প্রদত্ত অর্ডার আইডি ও মোবাইল নম্বরের সাথে মিলে যাওয়া কোনো অর্ডার পাওয়া যায়নি।' });
      return;
    }

    res.json(hydrateOrders([row])[0]);
  } catch {
    res.status(500).json({ error: 'অর্ডার অনুসন্ধানে সমস্যা হয়েছে।' });
  }
});

// ==========================================
// ADMIN AUTHENTICATION ENDPOINTS
// ==========================================

app.get('/api/admin/auth/status', (req, res) => {
  const envConfigured = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
  const adminCount = (db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number }).count;
  const needsSetup = !envConfigured && adminCount === 0;

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const verified = token ? verifyAdminToken(token) : null;

  res.json({
    needsSetup,
    authenticated: Boolean(verified),
    username: verified?.username || null,
  });
});

app.post('/api/admin/auth/setup', (req, res) => {
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

    const setupTx = db.transaction(() => {
      const existingCount = (db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number }).count;
      if (existingCount > 0) {
        throw new Error('ALREADY_SETUP');
      }
      const { hash, salt } = hashPassword(cleanPassword);
      db.prepare('INSERT INTO admin_users (username, password_hash, salt) VALUES (?, ?, ?)').run(
        cleanUsername,
        hash,
        salt
      );
    });

    setupTx();
    const token = signAdminToken(cleanUsername);
    res.status(201).json({ token, username: cleanUsername });
  } catch (error: any) {
    if (error?.message === 'ALREADY_SETUP') {
      res.status(403).json({ error: 'অ্যাডমিন অ্যাকাউন্ট ইতিমধ্যে তৈরি করা হয়েছে। অনুগ্রহ করে লগইন করুন।' });
      return;
    }
    res.status(500).json({ error: 'অ্যাডমিন অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে।' });
  }
});

const loginRateLimits = new Map<string, { count: number; resetAt: number }>();

app.post('/api/admin/auth/login', (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = loginRateLimits.get(clientIp);
    if (record && now < record.resetAt && record.count >= 10) {
      res.status(429).json({ error: 'অতিরিক্ত ভুল চেষ্টার কারণে সাময়িকভাবে লগইন ব্লক করা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।' });
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

    // Environment variable override takes precedence when configured
    const envPass = process.env.ADMIN_PASSWORD;
    const envUser = process.env.ADMIN_USERNAME || 'admin';
    if (envPass && envPass.trim().length > 0) {
      const userMatches = cleanUsername === envUser;
      const passBuf = Buffer.from(cleanPassword);
      const envBuf = Buffer.from(envPass);
      const passMatches = passBuf.length === envBuf.length && crypto.timingSafeEqual(passBuf, envBuf);

      if (userMatches && passMatches) {
        loginRateLimits.delete(clientIp);
        const token = signAdminToken(cleanUsername);
        res.json({ token, username: cleanUsername });
        return;
      }
      recordFailedAttempt();
      res.status(401).json({ error: 'ভুল ইউজারনেম অথবা পাসওয়ার্ড।' });
      return;
    }

    const admin = db
      .prepare('SELECT id, username, password_hash, salt FROM admin_users WHERE username = ?')
      .get(cleanUsername) as
      | { id: number; username: string; password_hash: string; salt: string }
      | undefined;

    if (!admin || !verifyPassword(cleanPassword, admin.password_hash, admin.salt)) {
      recordFailedAttempt();
      res.status(401).json({ error: 'ভুল ইউজারনেম অথবা পাসওয়ার্ড।' });
      return;
    }

    loginRateLimits.delete(clientIp);
    const token = signAdminToken(admin.username);
    res.json({ token, username: admin.username });
  } catch {
    res.status(500).json({ error: 'লগইন করতে সমস্যা হয়েছে।' });
  }
});

app.post('/api/admin/auth/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const verified = verifyAdminToken(token);
      if (verified) {
        db.prepare('INSERT OR IGNORE INTO revoked_tokens (jti, exp) VALUES (?, ?)').run(
          verified.jti,
          verified.exp
        );
        db.prepare('DELETE FROM revoked_tokens WHERE exp < ?').run(Date.now());
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

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  try {
    const totalOrders = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as { c: number }).c;
    const pendingOrders = (
      db
        .prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('অর্ডার গ্রহণ করা হয়েছে।', 'অর্ডার নিশ্চিত করা হয়েছে।', 'পণ্য পাঠানো হয়েছে।')")
        .get() as { c: number }
    ).c;
    const completedOrders = (
      db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'ডেলিভারি সম্পন্ন হয়েছে।'").get() as { c: number }
    ).c;
    const cancelledOrders = (
      db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'অর্ডার বাতিল হয়েছে।'").get() as { c: number }
    ).c;
    const totalProducts = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
    const totalSalesRow = db
      .prepare("SELECT COALESCE(SUM(total_amount), 0) as sum FROM orders WHERE status != 'অর্ডার বাতিল হয়েছে।'")
      .get() as { sum: number };

    const recentRows = db
      .prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 6')
      .all() as Array<Record<string, unknown>>;

    res.json({
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalProducts,
      totalSales: Number(totalSalesRow.sum || 0),
      recentOrders: hydrateOrders(recentRows),
    });
  } catch {
    res.status(500).json({ error: 'ড্যাশবোর্ড তথ্য লোড করা যায়নি।' });
  }
});

// Upload image endpoint
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'ছবি আপলোড ব্যর্থ হয়েছে।' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'কোনো ছবি নির্বাচন করা হয়নি।' });
      return;
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

// Admin Products CRUD
app.get('/api/admin/products', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.id DESC`
    )
    .all() as Array<Record<string, unknown>>;
  res.json(hydrateProducts(rows));
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
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
    const discPrice = discount_price !== null && discount_price !== '' && discount_price !== undefined ? Number(discount_price) : null;
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

    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO products (name, slug, category_id, regular_price, discount_price, description, stock, status, is_featured, is_popular)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          cleanName,
          makeSlug(cleanName),
          catId,
          regPrice,
          discPrice,
          cleanDesc,
          parsedStock,
          cleanStatus,
          is_featured ? 1 : 0,
          is_popular ? 1 : 0
        );

      const productId = Number(info.lastInsertRowid);
      const insertImg = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)');
      cleanImages.forEach((url, idx) => insertImg.run(productId, url, idx));

      return db
        .prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?')
        .get(productId) as Record<string, unknown>;
    });

    const created = tx();
    res.status(201).json(hydrateProducts([created])[0]);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'পণ্য সংরক্ষণ করতে সমস্যা হয়েছে।' });
  }
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'অবৈধ পণ্য আইডি।' });
      return;
    }

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
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
    const discPrice = discount_price !== null && discount_price !== '' && discount_price !== undefined ? Number(discount_price) : null;
    const parsedStock = Number(stock);

    if (cleanName.length < 2 || !Number.isFinite(regPrice) || regPrice <= 0 || !Number.isInteger(parsedStock) || parsedStock < 0) {
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

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE products
         SET name = ?, category_id = ?, regular_price = ?, discount_price = ?,
             description = ?, stock = ?, status = ?, is_featured = ?, is_popular = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        cleanName,
        catId,
        regPrice,
        discPrice,
        cleanDesc,
        parsedStock,
        cleanStatus,
        is_featured ? 1 : 0,
        is_popular ? 1 : 0,
        id
      );

      if (cleanImages !== null) {
        db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
        const insertImg = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)');
        cleanImages.forEach((url, idx) => insertImg.run(id, url, idx));
      }

      return db
        .prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?')
        .get(id) as Record<string, unknown>;
    });

    const updated = tx();
    res.json(hydrateProducts([updated])[0]);
  } catch {
    res.status(500).json({ error: 'পণ্য আপডেট করতে সমস্যা হয়েছে।' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'অবৈধ পণ্য আইডি।' });
    return;
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ success: true });
});

// Admin Categories CRUD
app.get('/api/admin/categories', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.id ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, description, sort_order } = req.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < 2) {
    res.status(400).json({ error: 'ক্যাটাগরির নাম লিখুন।' });
    return;
  }
  const info = db
    .prepare('INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)')
    .run(cleanName, makeSlug(cleanName), typeof description === 'string' ? description.trim() : '', Number(sort_order) || 0);
  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, description, sort_order } = req.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!Number.isInteger(id) || cleanName.length < 2) {
    res.status(400).json({ error: 'সঠিক ক্যাটাগরির তথ্য দিন।' });
    return;
  }
  db.prepare('UPDATE categories SET name = ?, description = ?, sort_order = ? WHERE id = ?').run(
    cleanName,
    typeof description === 'string' ? description.trim() : '',
    Number(sort_order) || 0,
    id
  );
  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.json(updated);
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'অবৈধ ক্যাটাগরি।' });
    return;
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ success: true });
});

// Admin Orders Management
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(order_code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }
    if (dateFrom) {
      conditions.push('date(created_at) >= date(?)');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('date(created_at) <= date(?)');
      params.push(dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM orders ${where} ORDER BY id DESC`)
      .all(...params) as Array<Record<string, unknown>>;

    res.json(hydrateOrders(rows));
  } catch {
    res.status(500).json({ error: 'অর্ডার তালিকা লোড করতে সমস্যা হয়েছে।' });
  }
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body ?? {};
    if (!Number.isInteger(id) || !ALLOWED_ORDER_STATUSES.includes(status)) {
      res.status(400).json({ error: 'অবৈধ অর্ডার স্ট্যাটাস।' });
      return;
    }

    const tx = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
        | { id: number; status: string }
        | undefined;
      if (!order) {
        throw new Error('NOT_FOUND');
      }

      const cancelledStatus = 'অর্ডার বাতিল হয়েছে।';
      // Restore stock when cancelling, deduct if un-cancelling
      if (order.status !== cancelledStatus && status === cancelledStatus) {
        const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id) as Array<{
          product_id: number;
          quantity: number;
        }>;
        for (const item of items) {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id);
        }
      } else if (order.status === cancelledStatus && status !== cancelledStatus) {
        const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id) as Array<{
          product_id: number;
          quantity: number;
        }>;
        for (const item of items) {
          db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(item.quantity, item.product_id);
        }
      }

      db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
      const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown>;
      return hydrateOrders([updated])[0];
    });

    res.json(tx());
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'অর্ডারটি পাওয়া যায়নি।' });
      return;
    }
    res.status(500).json({ error: 'অর্ডার স্ট্যাটাস আপডেট করা যায়নি।' });
  }
});

// Delete all orders & sales records (Admin only, requires explicit confirmation flag)
app.delete('/api/admin/orders', requireAdmin, (req, res) => {
  try {
    if (req.body?.confirmDeleteAll !== true) {
      res.status(400).json({ error: 'সব অর্ডার মুছে ফেলার জন্য নিশ্চিতকরণ প্রয়োজন।' });
      return;
    }

    const deleteAllTx = db.transaction(() => {
      db.prepare('DELETE FROM order_items').run();
      const result = db.prepare('DELETE FROM orders').run();
      return result.changes;
    });

    const deletedCount = deleteAllTx();
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
app.get('/api/admin/banners', requireAdmin, (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC')
    .all()
    .map((b: any) => ({ ...b, is_active: Boolean(b.is_active) }));
  res.json(rows);
});

app.post('/api/admin/banners', requireAdmin, (req, res) => {
  const { title, subtitle, cta_text, cta_link, image_url, is_active, sort_order } = req.body ?? {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanImage = sanitizeImageUrl(typeof image_url === 'string' ? image_url : '');
  if (cleanTitle.length < 2 || !cleanImage) {
    res.status(400).json({ error: 'ব্যানারের শিরোনাম ও ছবি প্রদান করুন।' });
    return;
  }

  const info = db
    .prepare(
      'INSERT INTO banners (title, subtitle, cta_text, cta_link, image_url, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      cleanTitle,
      typeof subtitle === 'string' ? subtitle.trim() : '',
      typeof cta_text === 'string' && cta_text.trim() ? cta_text.trim() : 'এখনই দেখুন',
      typeof cta_link === 'string' && cta_link.trim() ? cta_link.trim() : '#catalog',
      cleanImage,
      is_active === false ? 0 : 1,
      Number(sort_order) || 0
    );

  const created = db.prepare('SELECT * FROM banners WHERE id = ?').get(info.lastInsertRowid) as any;
  res.status(201).json({ ...created, is_active: Boolean(created.is_active) });
});

app.put('/api/admin/banners/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { title, subtitle, cta_text, cta_link, image_url, is_active, sort_order } = req.body ?? {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanImage = sanitizeImageUrl(typeof image_url === 'string' ? image_url : '');
  if (!Number.isInteger(id) || cleanTitle.length < 2 || !cleanImage) {
    res.status(400).json({ error: 'ব্যানারের সঠিক তথ্য প্রদান করুন।' });
    return;
  }

  db.prepare(
    'UPDATE banners SET title = ?, subtitle = ?, cta_text = ?, cta_link = ?, image_url = ?, is_active = ?, sort_order = ? WHERE id = ?'
  ).run(
    cleanTitle,
    typeof subtitle === 'string' ? subtitle.trim() : '',
    typeof cta_text === 'string' && cta_text.trim() ? cta_text.trim() : 'এখনই দেখুন',
    typeof cta_link === 'string' && cta_link.trim() ? cta_link.trim() : '#catalog',
    cleanImage,
    is_active === false ? 0 : 1,
    Number(sort_order) || 0,
    id
  );

  const updated = db.prepare('SELECT * FROM banners WHERE id = ?').get(id) as any;
  res.json({ ...updated, is_active: Boolean(updated.is_active) });
});

app.delete('/api/admin/banners/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM banners WHERE id = ?').run(id);
  res.json({ success: true });
});

// Admin Reviews Management
app.get('/api/admin/reviews', requireAdmin, (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM reviews ORDER BY id DESC')
    .all()
    .map((r: any) => ({ ...r, is_active: Boolean(r.is_active) }));
  res.json(rows);
});

app.post('/api/admin/reviews', requireAdmin, (req, res) => {
  const { customer_name, location, rating, comment, product_name } = req.body ?? {};
  if (!customer_name || !comment) {
    res.status(400).json({ error: 'গ্রাহকের নাম এবং মতামত লিখুন।' });
    return;
  }
  const info = db
    .prepare('INSERT INTO reviews (customer_name, location, rating, comment, product_name) VALUES (?, ?, ?, ?, ?)')
    .run(
      String(customer_name).trim(),
      String(location || 'বাংলাদেশ').trim(),
      Math.min(5, Math.max(1, Number(rating) || 5)),
      String(comment).trim(),
      String(product_name || '').trim()
    );
  const created = db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid) as any;
  res.status(201).json({ ...created, is_active: Boolean(created.is_active) });
});

app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  res.json({ success: true });
});

// Admin Website & Delivery Settings
app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json(getSettingsObject());
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
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

    const upsert = db.prepare(
      'INSERT INTO website_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );

    const tx = db.transaction(() => {
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
          upsert.run(key, val);
        }
      }
    });

    tx();
    res.json(getSettingsObject());
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

// ==========================================
// VITE / STATIC SERVING
// ==========================================

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
