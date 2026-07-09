-- Create system settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read of system settings (e.g. for open logistics page)
CREATE POLICY "Allow public read system_settings"
  ON system_settings FOR SELECT
  USING (true);

-- Allow authenticated HQ users to modify system settings
CREATE POLICY "Allow HQ manage system_settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (get_user_role() = 'hq')
  WITH CHECK (get_user_role() = 'hq');

-- Insert default logistics sn items setting
INSERT INTO system_settings (key, value)
VALUES ('logistics_sn_items', '["K100", "L100"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
