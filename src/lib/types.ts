export type UserRole = 'retailer' | 'distributor' | 'hq'

export type UserStatus = 'active' | 'restricted' | 'suspended'

export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'QUOTE_SENT'
  | 'ORDER_PLACED'
  | 'APPROVED'
  | 'REJECTED'
  | 'HQ_RECEIVED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'

export interface UserProfile {
  id: string
  role: UserRole
  company_name: string
  contact_name: string | null
  phone: string | null
  address: string | null
  distributor_id: string | null
  status: UserStatus
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  product_code: string
  name: string
  category: string | null
  options: ProductOption[]
  image_url: string | null
  moq: number
  order_unit: number
  consumer_price: number | null
  product_url: string | null
  is_active: boolean
  created_at: string
}

export interface ProductOption {
  code: string
  name: string
}

export interface RetailerPriceQuote {
  id: string
  distributor_id: string
  retailer_id: string
  product_id: string
  option_code: string | null
  unit_price: number
  effective_from: string
  effective_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  product?: Product
}

export interface DistributorPriceQuote {
  id: string
  distributor_id: string
  product_id: string
  option_code: string | null
  unit_price: number
  effective_from: string
  effective_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  product?: Product
}

export interface Order {
  id: string
  order_number: string
  retailer_id: string
  distributor_id: string
  status: OrderStatus
  order_type: 'quote' | 'direct'
  fulfillment_type: 'hq' | 'distributor'
  shipping_address: string | null
  desired_date: string | null
  note: string | null
  retailer_total: number
  hq_total: number
  quote_expires_at: string | null
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
  retailer?: UserProfile
  distributor?: UserProfile
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  option_code: string | null
  quantity: number
  retailer_unit_price: number | null
  retailer_amount: number | null
  hq_unit_price: number | null
  hq_amount: number | null
  created_at: string
  product?: Product
}

export interface DistributorRetailerProductSetting {
  id: string
  distributor_id: string
  product_id: string
  moq: number
  order_unit: number
  created_at: string
  updated_at: string
  product?: Product
}

// 주문 상태 한국어 라벨
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: '견적 작성 중',
  SUBMITTED: '견적 요청',
  QUOTE_SENT: '견적 발송',
  ORDER_PLACED: '발주 확정',
  APPROVED: '승인완료',
  REJECTED: '반려',
  HQ_RECEIVED: '본사접수',
  PREPARING: '출고준비',
  SHIPPED: '출고완료',
  DELIVERED: '수령완료',
  COMPLETED: '완료',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  QUOTE_SENT: 'bg-orange-100 text-orange-700',
  ORDER_PLACED: 'bg-violet-100 text-violet-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  HQ_RECEIVED: 'bg-purple-100 text-purple-700',
  PREPARING: 'bg-yellow-100 text-yellow-700',
  SHIPPED: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-teal-100 text-teal-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  retailer: '소매점',
  distributor: '총판',
  hq: '본사',
}
