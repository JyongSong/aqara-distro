-- 주문 테이블에 송장번호 컬럼 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
