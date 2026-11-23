export type OrderStatus =
  | 'অর্ডার গ্রহণ করা হয়েছে।'
  | 'অর্ডার নিশ্চিত করা হয়েছে।'
  | 'পণ্য পাঠানো হয়েছে।'
  | 'ডেলিভারি সম্পন্ন হয়েছে।'
  | 'অর্ডার বাতিল হয়েছে।';

export const ORDER_STATUSES: OrderStatus[] = [
  'অর্ডার গ্রহণ করা হয়েছে।',
  'অর্ডার নিশ্চিত করা হয়েছে।',
  'পণ্য পাঠানো হয়েছে।',
  'ডেলিভারি সম্পন্ন হয়েছে।',
  'অর্ডার বাতিল হয়েছে।',
];

export type DeliveryArea = 'inside_dhaka' | 'outside_dhaka';

export interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  sort_order: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  product_count?: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
  category_name: string;
  regular_price: number;
  discount_price: number | null;
  description: string;
  stock: number;
  status: 'active' | 'inactive';
  is_featured: boolean;
  is_popular: boolean;
  images: ProductImage[];
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
}

export interface Review {
  id: number;
  customer_name: string;
  location: string;
  rating: number;
  comment: string;
  product_name: string;
  is_active: boolean;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  product_image: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: number;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  division: string;
  district: string;
  address: string;
  delivery_area: DeliveryArea;
  delivery_charge: number;
  subtotal: number;
  total_amount: number;
  payment_method: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface WebsiteSettings {
  website_name: string;
  website_logo: string;
  primary_color: string;
  secondary_color: string;
  button_color: string;
  delivery_inside_dhaka: number;
  delivery_outside_dhaka: number;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  contact_hours: string;
  social_facebook: string;
  social_instagram: string;
  social_youtube: string;
  social_whatsapp: string;
  footer_about: string;
  footer_copyright: string;
  welcome_title: string;
  welcome_message: string;
  special_offer_title: string;
  special_offer_subtitle: string;
  special_offer_highlight: string;
  show_banners: boolean;
  show_categories: boolean;
  show_featured: boolean;
  show_latest: boolean;
  show_popular: boolean;
  show_special_offers: boolean;
  show_reviews: boolean;
  show_contact: boolean;
  section_title_featured: string;
  section_title_latest: string;
  section_title_popular: string;
  section_title_reviews: string;
}

export interface StorefrontData {
  settings: WebsiteSettings;
  banners: Banner[];
  categories: Category[];
  products: Product[];
  reviews: Review[];
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalProducts: number;
  totalSales: number;
  recentOrders: Order[];
}
