-- RED Collector - Supabase Database Schema
-- Run this in Supabase SQL Editor to set up all tables and policies

-- ============================================================
-- 1. USER SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 2. FAVORITES TABLE (cloud sync for pro users)
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  tags TEXT[] DEFAULT '{}',
  note TEXT DEFAULT '',
  favicon_url TEXT,
  folder TEXT DEFAULT 'default',
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. ACTIVATION CODES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  created_by UUID REFERENCES auth.users,
  used_by UUID REFERENCES auth.users,
  used_at TIMESTAMPTZ,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- No RLS policies: all operations via Edge Function (service_role)

-- ============================================================
-- 4. ORDERS TABLE (payment tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  user_email TEXT,
  plan TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  payment_note TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 5. AUTO-GENERATE ACTIVATION CODE ON PAYMENT
-- ============================================================
CREATE OR REPLACE FUNCTION generate_code_on_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    INSERT INTO activation_codes (code, plan, created_by)
    VALUES (
      UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 12)),
      NEW.plan,
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_paid_trigger
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_code_on_paid();
