CREATE TABLE IF NOT EXISTS profile_photo_audit(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,photo_url TEXT NOT NULL,uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_profile_photo_audit_user ON profile_photo_audit(user_id);
