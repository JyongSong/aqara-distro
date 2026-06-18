-- ======================================
-- 006: 대리점 지원 설문 테이블 생성 및 RLS 정책 설정
-- ======================================

CREATE TABLE IF NOT EXISTS partner_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'registered')),
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_position TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  email TEXT,
  business_zipcode TEXT NOT NULL,
  business_address TEXT NOT NULL,
  business_address_detail TEXT,
  sales_experience TEXT NOT NULL,
  installation_experience TEXT NOT NULL, -- 도어락 설치 경력
  annual_sales_volume TEXT NOT NULL,
  sales_target TEXT NOT NULL,
  installation_method TEXT NOT NULL,
  installation_staff TEXT NOT NULL,
  iot_expansion_intent TEXT NOT NULL,
  support_purpose TEXT[] NOT NULL DEFAULT '{}', -- 지원 사유
  support_purpose_other TEXT,
  interested_products TEXT[] NOT NULL DEFAULT '{}', -- 관심 제품
  additional_inquiry TEXT,
  registered_user_id UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 연락처에 대한 UNIQUE 인덱스 추가 (중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_surveys_phone ON partner_surveys(contact_phone);

-- RLS 활성화
ALTER TABLE partner_surveys ENABLE ROW LEVEL SECURITY;

-- 1. 비로그인 대외 사용자: 설문 제출(INSERT) 허용
CREATE POLICY "Allow public insert to partner_surveys"
  ON partner_surveys FOR INSERT
  WITH CHECK (true);

-- 2. 비로그인 대외 사용자: 가입 화면에서 survey_id로 자기 설문정보 단건 조회(SELECT) 허용
-- 단, 상태가 'approved'(승인됨)인 건에 대해서만 정보 조회가 가능하도록 보호함
CREATE POLICY "Allow public select approved partner_surveys by id"
  ON partner_surveys FOR SELECT
  USING (status = 'approved');

-- 3. HQ(본사) 관리자: 모든 설문 정보 조회(SELECT) 허용
CREATE POLICY "Allow HQ select all partner_surveys"
  ON partner_surveys FOR SELECT
  USING (get_user_role() = 'hq');

-- 4. HQ(본사) 관리자: 설문 정보 수정(UPDATE) 허용 (승인, 거절 상태 처리 등)
CREATE POLICY "Allow HQ update partner_surveys"
  ON partner_surveys FOR UPDATE
  USING (get_user_role() = 'hq');

-- updated_at 자동 갱신 트리거 설정
CREATE TRIGGER set_updated_at_partner_surveys
  BEFORE UPDATE ON partner_surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
