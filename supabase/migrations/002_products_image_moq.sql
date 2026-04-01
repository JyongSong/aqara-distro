-- 002: Add image_url, moq, order_unit to products; create product-images storage bucket

-- Add new columns to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS moq INTEGER NOT NULL DEFAULT 1 CHECK (moq >= 1),
  ADD COLUMN IF NOT EXISTS order_unit INTEGER NOT NULL DEFAULT 1 CHECK (order_unit >= 1);

-- Create public storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for product images
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- HQ can upload product images
CREATE POLICY "HQ upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND (SELECT role FROM users_profile WHERE id = auth.uid()) = 'hq'
  );

-- HQ can update product images
CREATE POLICY "HQ update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND (SELECT role FROM users_profile WHERE id = auth.uid()) = 'hq'
  );

-- HQ can delete product images
CREATE POLICY "HQ delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND (SELECT role FROM users_profile WHERE id = auth.uid()) = 'hq'
  );
