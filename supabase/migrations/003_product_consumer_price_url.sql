-- 003: 상품 소비자가 및 상품 URL 추가

ALTER TABLE products ADD COLUMN IF NOT EXISTS consumer_price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_url TEXT;
