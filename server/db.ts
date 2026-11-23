import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'store.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      regular_price REAL NOT NULL,
      discount_price REAL,
      description TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_popular INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      cta_text TEXT NOT NULL DEFAULT 'এখনই দেখুন',
      cta_link TEXT NOT NULL DEFAULT '#catalog',
      image_url TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      division TEXT NOT NULL,
      district TEXT NOT NULL,
      address TEXT NOT NULL,
      delivery_area TEXT NOT NULL CHECK (delivery_area IN ('inside_dhaka', 'outside_dhaka')),
      delivery_charge REAL NOT NULL,
      subtotal REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'ক্যাশ অন ডেলিভারি',
      status TEXT NOT NULL DEFAULT 'অর্ডার গ্রহণ করা হয়েছে।',
      client_request_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_image TEXT NOT NULL DEFAULT '',
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS website_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      location TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      comment TEXT NOT NULL,
      product_name TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      exp INTEGER NOT NULL
    );
  `);

  seedDefaultsIfEmpty();
}

function seedDefaultsIfEmpty(): void {
  const welcomeSubtitle =
    'আপনার পছন্দের সব পণ্য এখন এক জায়গায়। সাশ্রয়ী দামে মানসম্মত পণ্য কেনাকাটার সহজ ও নির্ভরযোগ্য ঠিকানা DSK SHOP BD। আমরা প্রতিটি গ্রাহকের সন্তুষ্টিকে গুরুত্ব দিই। ঘরে বসেই অর্ডার করুন, পণ্য পৌঁছে যাবে আপনার ঠিকানায়। আমাদের সঙ্গে থাকার জন্য ধন্যবাদ।';

  const defaultSettings: Record<string, string> = {
    website_name: 'DSK SHOP BD',
    website_logo: '',
    primary_color: '#0F5132',
    secondary_color: '#B45309',
    button_color: '#0F5132',
    delivery_inside_dhaka: '80',
    delivery_outside_dhaka: '180',
    contact_phone: '০১৭১১-০০০০০০',
    contact_email: 'dskhub11@gmail.com',
    contact_address: 'বাড়ি ২৪, রোড ৭, ধানমন্ডি, ঢাকা-১২০৫, বাংলাদেশ',
    contact_hours: 'প্রতিদিন সকাল ৯টা – রাত ১০টা',
    social_facebook: 'https://facebook.com',
    social_instagram: 'https://instagram.com',
    social_youtube: 'https://youtube.com',
    social_whatsapp: 'https://wa.me/8801711000000',
    footer_about: welcomeSubtitle,
    footer_copyright: '© ২০২৬ DSK SHOP BD। সর্বস্বত্ব সংরক্ষিত।',
    welcome_title: 'DSK SHOP BD-তে আপনাকে স্বাগতম!',
    welcome_message: welcomeSubtitle,
    special_offer_title: 'উৎসবের বিশেষ মূল্যছাড় — নির্বাচিত পণ্যে ২৫% পর্যন্ত সাশ্রয়',
    special_offer_subtitle:
      'ঢাকাই জামদানি, সুন্দরবনের খাঁটি মধু এবং হাতে তৈরি চামড়াজাত পণ্যে সীমিত সময়ের বিশেষ অফার। কোনো অগ্রিম পেমেন্ট ছাড়াই ক্যাশ অন ডেলিভারিতে অর্ডার করুন।',
    special_offer_highlight: 'সারা বাংলাদেশে হোম ডেলিভারি',
    show_banners: 'true',
    show_categories: 'true',
    show_featured: 'true',
    show_latest: 'true',
    show_popular: 'true',
    show_special_offers: 'true',
    show_reviews: 'true',
    show_contact: 'true',
    section_title_featured: 'বিশেষ নির্বাচিত পণ্য',
    section_title_latest: 'নতুন সংযোজন',
    section_title_popular: 'জনপ্রিয় পণ্যসমূহ',
    section_title_reviews: 'গ্রাহকদের ভালোবাসা ও মতামত',
  };

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO website_settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }

  // Migrate initial placeholder brand if untouched in existing DB
  const currentNameRow = db
    .prepare("SELECT value FROM website_settings WHERE key = 'website_name'")
    .get() as { value: string } | undefined;
  if (currentNameRow?.value === 'সোনালী হাট') {
    const updateSetting = db.prepare('UPDATE website_settings SET value = ? WHERE key = ?');
    updateSetting.run('DSK SHOP BD', 'website_name');
    updateSetting.run('dskhub11@gmail.com', 'contact_email');
    updateSetting.run(welcomeSubtitle, 'footer_about');
    updateSetting.run('© ২০২৬ DSK SHOP BD। সর্বস্বত্ব সংরক্ষিত।', 'footer_copyright');
    db.prepare(
      "UPDATE banners SET title = ?, subtitle = ? WHERE title = 'বাংলার আদি ঐতিহ্য — হাতে বোনা ঢাকাই জামদানি'"
    ).run('DSK SHOP BD-তে আপনাকে স্বাগতম!', welcomeSubtitle);
  }

  const categoryCount = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
  if (categoryCount === 0) {
    const categories = [
      {
        name: 'শাড়ি ও তাঁতবস্ত্র',
        slug: 'saree-handloom',
        description: 'ঢাকাই জামদানি, টাঙ্গাইল ও মসলিন ঐতিহ্যবাহী তাঁতবস্ত্র',
        sort_order: 1,
      },
      {
        name: 'পুরুষদের পোশাক',
        slug: 'mens-wear',
        description: 'হাতে কাজ করা সুতি পাঞ্জাবি ও ঐতিহ্যবাহী পোশাক',
        sort_order: 2,
      },
      {
        name: 'খাঁটি খাদ্যপণ্য',
        slug: 'organic-pantry',
        description: 'সুন্দরবনের মধু, ঘানি ভাঙা সরিষার তেল ও প্রাকৃতিক মসলা',
        sort_order: 3,
      },
      {
        name: 'গৃহসজ্জা ও নকশিকাঁথা',
        slug: 'home-craft',
        description: 'হাতে সেলাই করা নকশিকাঁথা ও মৃৎশিল্প',
        sort_order: 4,
      },
      {
        name: 'চামড়াজাত পণ্য',
        slug: 'leather-goods',
        description: 'বাংলাদেশি খাঁটি চামড়ার ব্যাগ ও এক্সেসরিজ',
        sort_order: 5,
      },
    ];

    const insertCat = db.prepare(
      'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)'
    );
    for (const c of categories) {
      insertCat.run(c.name, c.slug, c.description, c.sort_order);
    }
  }

  const bannerCount = (db.prepare('SELECT COUNT(*) as count FROM banners').get() as { count: number }).count;
  if (bannerCount === 0) {
    const insertBanner = db.prepare(
      'INSERT INTO banners (title, subtitle, cta_text, cta_link, image_url, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertBanner.run(
      'DSK SHOP BD-তে আপনাকে স্বাগতম!',
      welcomeSubtitle,
      'পণ্যসমূহ দেখুন',
      '#catalog',
      '/src/assets/images/hero_banner_jamdani_1795399479076.jpg',
      1,
      1
    );
    insertBanner.run(
      'শতভাগ খাঁটি ও প্রাকৃতিক — সুন্দরবনের মধু ও ঘানি ভাঙা পণ্য',
      'সরাসরি সংগ্রহস্থল থেকে যাচাইকৃত ভেজালমুক্ত খাদ্যপণ্য। দ্রুত সময়ে দেশের ৬৪ জেলায় হোম ডেলিভারি।',
      'বিশেষ অফার দেখুন',
      '#special-offers',
      '/src/assets/images/hero_banner_pantry_1795399478140.jpg',
      1,
      2
    );
  }

  const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  if (productCount === 0) {
    const getCatId = (slug: string): number | null => {
      const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as { id: number } | undefined;
      return row ? row.id : null;
    };

    const seededProducts = [
      {
        name: 'আসল ঢাকাই জামদানি শাড়ি (আইভরি ও পান্না সবুজ)',
        slug: 'dhakai-jamdani-ivory-emerald',
        category_id: getCatId('saree-handloom'),
        regular_price: 8500,
        discount_price: 6950,
        description:
          'রূপগঞ্জের অভিজ্ঞ তাঁতিদের হাতে বোনা ৮৪ কাউন্টের খাঁটি সুতি ঢাকাই জামদানি শাড়ি। ১২ হাত দীর্ঘ শাড়ির সাথে রয়েছে ম্যাচিং ব্লাউজ পিস। উৎসব, বিয়ে ও বিশেষ আয়োজনে পরার জন্য অত্যন্ত আরামদায়ক ও আভিজাত্যপূর্ণ।',
        stock: 14,
        status: 'active',
        is_featured: 1,
        is_popular: 1,
        images: [
          '/src/assets/images/product_jamdani_saree_1795399478726.jpg',
          '/src/assets/images/hero_banner_jamdani_1795399479076.jpg',
        ],
      },
      {
        name: 'রাজকীয় এমব্রয়ডারি সুতি পাঞ্জাবি (জলপাই সবুজ)',
        slug: 'royal-cotton-panjabi-olive',
        category_id: getCatId('mens-wear'),
        regular_price: 2450,
        discount_price: 1990,
        description:
          'শতভাগ খাঁটি কম্ফোর্ট-উইভ কটন কাপড়ে তৈরি প্রিমিয়াম পাঞ্জাবি। কলার ও প্লেটে নিখুঁত সূচিকর্ম এবং কাঠের বোতাম ব্যবহার করা হয়েছে। গরম ও উৎসব—উভয় সময়ের জন্য উপযোগী। সাইজ: M, L, XL, XXL।',
        stock: 32,
        status: 'active',
        is_featured: 1,
        is_popular: 1,
        images: ['/src/assets/images/product_panjabi_cotton_1795399478221.jpg'],
      },
      {
        name: 'সুন্দরবনের খাঁটি প্রাকৃতিক মধু (৫০০ গ্রাম কাঁচের জার)',
        slug: 'sundarban-wildflower-honey-500g',
        category_id: getCatId('organic-pantry'),
        regular_price: 950,
        discount_price: 790,
        description:
          'সুন্দরবনের গহিন অরণ্য থেকে সংগৃহীত শতভাগ প্রাকৃতিক ও অপরিশোধিত খলিশা ফুলের মধু। কোনো কৃত্রিম চিনি বা প্রিজারভেটিভ ছাড়াই স্বাস্থ্যসম্মত কাঁচের জারে প্যাকেজিং করা।',
        stock: 60,
        status: 'active',
        is_featured: 1,
        is_popular: 1,
        images: [
          '/src/assets/images/product_sundarban_honey_1795399479314.jpg',
          '/src/assets/images/hero_banner_pantry_1795399478140.jpg',
        ],
      },
      {
        name: 'হাতে সেলাই করা ঐতিহ্যবাহী নকশিকাঁথা (কিং সাইজ)',
        slug: 'traditional-nakshi-kantha-king',
        category_id: getCatId('home-craft'),
        regular_price: 4200,
        discount_price: 3450,
        description:
          'জামালপুরের গ্রামীণ কারিগরদের নিপুণ হাতে তৈরি চার স্তরের খাঁটি সুতি নকশিকাঁথা। প্রাকৃতিক ইন্ডিগো ও টেরাকোটা রঙের সুতোয় চমৎকার ফুল ও লতার নকশা। মাপ: ৭.৫ ফিট x ৮.৫ ফিট।',
        stock: 18,
        status: 'active',
        is_featured: 1,
        is_popular: 0,
        images: ['/src/assets/images/product_nakshi_kantha_1795399479014.jpg'],
      },
      {
        name: 'হ্যান্ডক্রাফটেড ফুল-গ্রেইন লেদার স্যাচেল ব্যাগ',
        slug: 'handcrafted-leather-satchel-bag',
        category_id: getCatId('leather-goods'),
        regular_price: 4800,
        discount_price: 3890,
        description:
          'বাংলাদেশের সেরা ট্যানারির ভেজিটেবল-ট্যানড ফুল-গ্রেইন গরুর চামড়ায় তৈরি টেকসই অফিস ও ট্রাভেল ব্যাগ। ভেতরে ১৪ ইঞ্চি ল্যাপটপের আলাদা প্যাডেড চেম্বার এবং মজবুত ব্রাশড ব্রাস বকলস রয়েছে।',
        stock: 11,
        status: 'active',
        is_featured: 0,
        is_popular: 1,
        images: ['/src/assets/images/product_leather_bag_1795399478505.jpg'],
      },
      {
        name: 'হাতে আঁকা মৃৎশিল্পের চা-সেট (কেতলি ও ২ কাপ + ট্রে)',
        slug: 'artisanal-terracotta-tea-set',
        category_id: getCatId('home-craft'),
        regular_price: 1650,
        discount_price: null,
        description:
          'ধামরাইয়ের মৃৎশিল্পীদের হাতে তৈরি ও পরিবেশবান্ধব রঙে আঁকা পোড়ামাটির ফুড-গ্রেড টি-পট ও দুটি কাপ, সাথে সেগুন কাঠের পরিবেশন ট্রে। গৃহসজ্জা ও অতিথি আপ্যায়নে অনন্য।',
        stock: 25,
        status: 'active',
        is_featured: 0,
        is_popular: 1,
        images: ['/src/assets/images/product_clay_tea_set_1795399477957.jpg'],
      },
      {
        name: 'উৎসবের স্পেশাল জামদানি ও শাড়ি গিফট কালেকশন',
        slug: 'festival-jamdani-emerald-gold',
        category_id: getCatId('saree-handloom'),
        regular_price: 9800,
        discount_price: 7850,
        description:
          'জরি ও সূক্ষ্ম পান্না-সবুজ সুতোয় বোনা বিশেষ উৎসব কালেকশনের জামদানি শাড়ি। প্রিমিয়াম গিফট বক্সসহ সরবরাহ করা হয়।',
        stock: 9,
        status: 'active',
        is_featured: 1,
        is_popular: 0,
        images: [
          '/src/assets/images/hero_banner_jamdani_1795399479076.jpg',
          '/src/assets/images/product_jamdani_saree_1795399478726.jpg',
        ],
      },
      {
        name: 'গ্রামীণ প্যান্ট্রি কম্বো (মধু + কাঠের ঘানির সরিষার তেল)',
        slug: 'organic-pantry-combo-pack',
        category_id: getCatId('organic-pantry'),
        regular_price: 1750,
        discount_price: 1450,
        description:
          '৫০০ গ্রাম সুন্দরবনের মধু এবং ৫০০ মিলি কাঠের ঘানিতে ভাঙা খাঁটি দেশি সরিষার তেলের সাশ্রয়ী পারিবারিক কম্বো প্যাক।',
        stock: 40,
        status: 'active',
        is_featured: 0,
        is_popular: 1,
        images: [
          '/src/assets/images/hero_banner_pantry_1795399478140.jpg',
          '/src/assets/images/product_sundarban_honey_1795399479314.jpg',
        ],
      },
    ];

    const insertProd = db.prepare(
      `INSERT INTO products (name, slug, category_id, regular_price, discount_price, description, stock, status, is_featured, is_popular)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertImg = db.prepare(
      'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)'
    );

    for (const p of seededProducts) {
      const info = insertProd.run(
        p.name,
        p.slug,
        p.category_id,
        p.regular_price,
        p.discount_price,
        p.description,
        p.stock,
        p.status,
        p.is_featured,
        p.is_popular
      );
      const productId = Number(info.lastInsertRowid);
      p.images.forEach((img, idx) => {
        insertImg.run(productId, img, idx);
      });
    }
  }

  const reviewCount = (db.prepare('SELECT COUNT(*) as count FROM reviews').get() as { count: number }).count;
  if (reviewCount === 0) {
    const insertReview = db.prepare(
      'INSERT INTO reviews (customer_name, location, rating, comment, product_name) VALUES (?, ?, ?, ?, ?)'
    );
    insertReview.run(
      'নুসরাত জাহান তানিয়া',
      'ধানমন্ডি, ঢাকা',
      5,
      'অ্যাকাউন্ট খোলার ঝামেলা ছাড়াই খুব সহজে অর্ডার করেছি। ২৪ ঘণ্টার মধ্যে আসল ঢাকাই জামদানি হাতে পেয়েছি, বুনন ও রঙ ছবির চেয়েও সুন্দর।',
      'আসল ঢাকাই জামদানি শাড়ি'
    );
    insertReview.run(
      'তানভীর আহমেদ',
      'আগ্রাবাদ, চট্টগ্রাম',
      5,
      'লেদার স্যাচেল ব্যাগটির চামড়ার মান এবং ফিনিশিং অসাধারণ। ক্যাশ অন ডেলিভারিতে নিশ্চিন্তে ডেলিভারি নিয়েছি।',
      'হ্যান্ডক্রাফটেড লেদার স্যাচেল ব্যাগ'
    );
    insertReview.run(
      'ফারহানা ইয়াসমিন',
      'উপশহর, সিলেট',
      5,
      'সুন্দরবনের মধু এবং নকশিকাঁথা দুটিই খাঁটি ও মানসম্মত। অর্ডার ট্র্যাকিং পেজ থেকে প্রতিটি ধাপ সহজেই দেখা গেছে।',
      'সুন্দরবনের খাঁটি প্রাকৃতিক মধু'
    );
  }
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}
