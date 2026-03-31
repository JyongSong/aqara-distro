-- ======================================
-- 아카라 스마트 발주·거래 관리 시스템
-- Initial Database Schema
-- ======================================

-- 1. 사용자 프로필
CREATE TABLE users_profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('retailer', 'distributor', 'hq')),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  address TEXT,
  distributor_id UUID REFERENCES users_profile(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_profile_role ON users_profile(role);
CREATE INDEX idx_users_profile_distributor ON users_profile(distributor_id);

-- 2. 상품
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  options JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_products_active ON products(is_active);

-- 3. 소매점 견적 단가 (총판 → 소매)
CREATE TABLE retailer_price_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES users_profile(id),
  retailer_id UUID NOT NULL REFERENCES users_profile(id),
  product_id UUID NOT NULL REFERENCES products(id),
  option_code TEXT,
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by UUID REFERENCES users_profile(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_retailer_prices_lookup ON retailer_price_quotes(
  retailer_id, product_id, option_code, effective_from
);

-- 4. 총판 공급 단가 (본사 → 총판)
CREATE TABLE distributor_price_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES users_profile(id),
  product_id UUID NOT NULL REFERENCES products(id),
  option_code TEXT,
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by UUID REFERENCES users_profile(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_distributor_prices_lookup ON distributor_price_quotes(
  distributor_id, product_id, option_code, effective_from
);

-- 5. 주문 (발주)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  retailer_id UUID NOT NULL REFERENCES users_profile(id),
  distributor_id UUID NOT NULL REFERENCES users_profile(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED',
    'HQ_RECEIVED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED'
  )),
  shipping_address TEXT,
  desired_date DATE,
  note TEXT,
  retailer_total INTEGER DEFAULT 0,
  hq_total INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users_profile(id),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_retailer ON orders(retailer_id);
CREATE INDEX idx_orders_distributor ON orders(distributor_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- 6. 주문 상세
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  option_code TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  retailer_unit_price INTEGER NOT NULL,
  retailer_amount INTEGER NOT NULL,
  hq_unit_price INTEGER,
  hq_amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ======================================
-- Row Level Security (RLS)
-- ======================================

ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users_profile WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: get current user's distributor_id
CREATE OR REPLACE FUNCTION get_user_distributor_id()
RETURNS UUID AS $$
  SELECT distributor_id FROM users_profile WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- === users_profile RLS ===
CREATE POLICY "Users can view own profile"
  ON users_profile FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "HQ can view all profiles"
  ON users_profile FOR SELECT
  USING (get_user_role() = 'hq');

CREATE POLICY "Distributor can view own retailers"
  ON users_profile FOR SELECT
  USING (
    get_user_role() = 'distributor'
    AND (id = auth.uid() OR distributor_id = auth.uid())
  );

CREATE POLICY "HQ can manage all profiles"
  ON users_profile FOR ALL
  USING (get_user_role() = 'hq');

-- === products RLS ===
CREATE POLICY "Anyone authenticated can view active products"
  ON products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "HQ can manage products"
  ON products FOR ALL
  USING (get_user_role() = 'hq');

-- === retailer_price_quotes RLS ===
CREATE POLICY "Retailer can view own prices"
  ON retailer_price_quotes FOR SELECT
  USING (retailer_id = auth.uid());

CREATE POLICY "Distributor can manage own retailer prices"
  ON retailer_price_quotes FOR ALL
  USING (distributor_id = auth.uid());

CREATE POLICY "HQ can view all retailer prices"
  ON retailer_price_quotes FOR SELECT
  USING (get_user_role() = 'hq');

-- === distributor_price_quotes RLS ===
CREATE POLICY "Distributor can view own HQ prices"
  ON distributor_price_quotes FOR SELECT
  USING (distributor_id = auth.uid());

CREATE POLICY "HQ can manage distributor prices"
  ON distributor_price_quotes FOR ALL
  USING (get_user_role() = 'hq');

-- === orders RLS ===
CREATE POLICY "Retailer can view own orders"
  ON orders FOR SELECT
  USING (retailer_id = auth.uid());

CREATE POLICY "Retailer can create own orders"
  ON orders FOR INSERT
  WITH CHECK (retailer_id = auth.uid());

CREATE POLICY "Retailer can update own draft orders"
  ON orders FOR UPDATE
  USING (retailer_id = auth.uid() AND status IN ('DRAFT', 'DELIVERED'));

CREATE POLICY "Distributor can view own orders"
  ON orders FOR SELECT
  USING (distributor_id = auth.uid());

CREATE POLICY "Distributor can update orders for approval"
  ON orders FOR UPDATE
  USING (distributor_id = auth.uid());

CREATE POLICY "HQ can view all orders"
  ON orders FOR SELECT
  USING (get_user_role() = 'hq');

CREATE POLICY "HQ can update all orders"
  ON orders FOR UPDATE
  USING (get_user_role() = 'hq');

-- === order_items RLS ===
CREATE POLICY "View order items through order access"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.retailer_id = auth.uid()
        OR orders.distributor_id = auth.uid()
        OR get_user_role() = 'hq'
      )
    )
  );

CREATE POLICY "Retailer can manage own order items"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.retailer_id = auth.uid()
      AND orders.status = 'DRAFT'
    )
  );

-- ======================================
-- updated_at 자동 갱신 트리거
-- ======================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users_profile
  BEFORE UPDATE ON users_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_retailer_prices
  BEFORE UPDATE ON retailer_price_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_distributor_prices
  BEFORE UPDATE ON distributor_price_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
