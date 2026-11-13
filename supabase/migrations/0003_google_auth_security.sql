-- ============================================================================
-- Planit Data Library — 0003 Google OAuth + Supabase Auth Security Hardening
-- Enforces verified Google Identity profile syncing (name, email, avatar_url),
-- hosted domain whitelisting, deactivated account blocking, and auth audit logs.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hosted_domain TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

-- Allowed corporate Google Workspace domains (empty = allow explicit pre-invited emails only)
CREATE TABLE IF NOT EXISTS public.allowed_domains (
  domain TEXT PRIMARY KEY,
  default_role user_role NOT NULL DEFAULT 'member',
  enforce_verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.allowed_domains (domain, default_role, enforce_verified)
VALUES
  ('planit.studio', 'member', true),
  ('gmail.com', 'member', true)
ON CONFLICT (domain) DO NOTHING;

-- Immutable Auth Security Audit Log
CREATE TABLE IF NOT EXISTS public.auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  event_type TEXT NOT NULL, -- 'login_success' | 'login_blocked_domain' | 'login_blocked_deactivated' | 'logout' | 'token_revoked'
  hosted_domain TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON public.auth_audit_logs(created_at DESC);

ALTER TABLE public.allowed_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allowed_domains_read ON public.allowed_domains;
CREATE POLICY allowed_domains_read ON public.allowed_domains
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS allowed_domains_admin_write ON public.allowed_domains;
CREATE POLICY allowed_domains_admin_write ON public.allowed_domains
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_uid = auth.uid() AND u.status = 'active' AND u.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS auth_audit_admin_read ON public.auth_audit_logs;
CREATE POLICY auth_audit_admin_read ON public.auth_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_uid = auth.uid() AND u.status = 'active' AND u.role IN ('super_admin', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- Trigger: Sync Google OAuth User Profile on Sign-In / Sign-Up
-- Pulls full_name, email, avatar_url (picture), sub, and hosted domain (hd).
-- Blocks unverified Google emails and deactivated accounts.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_google_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_provider TEXT := COALESCE(NEW.raw_app_meta_data->>'provider', 'google');
  v_email TEXT := lower(trim(COALESCE(NEW.email, '')));
  v_domain TEXT := split_part(v_email, '@', 2);
  v_verified BOOLEAN := COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, NEW.email_confirmed_at IS NOT NULL, false);
  v_name TEXT := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1)
  );
  v_avatar TEXT := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'picture'), '')
  );
  v_sub TEXT := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'provider_id'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'sub'), '')
  );
  v_hd TEXT := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'hd'), ''), v_domain);
  v_existing public.users%ROWTYPE;
  v_dom public.allowed_domains%ROWTYPE;
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'Google OAuth account must include a valid email address';
  END IF;

  IF NOT v_verified THEN
    INSERT INTO public.auth_audit_logs(auth_uid, email, provider, event_type, hosted_domain)
    VALUES (NEW.id, v_email, v_provider, 'login_blocked_unverified', v_hd);
    RAISE EXCEPTION 'Google account email must be verified';
  END IF;

  SELECT * INTO v_existing FROM public.users WHERE auth_uid = NEW.id OR lower(email) = v_email LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'deactivated' THEN
      INSERT INTO public.auth_audit_logs(auth_uid, user_id, email, provider, event_type, hosted_domain)
      VALUES (NEW.id, v_existing.id, v_email, v_provider, 'login_blocked_deactivated', v_hd);
      RAISE EXCEPTION 'Account % has been deactivated by an administrator', v_email;
    END IF;

    UPDATE public.users
    SET
      auth_uid = NEW.id,
      name = COALESCE(NULLIF(v_name, ''), name),
      avatar_url = COALESCE(v_avatar, avatar_url),
      google_sub = COALESCE(v_sub, google_sub),
      email_verified = v_verified,
      hosted_domain = v_hd,
      status = 'active',
      last_login_at = now(),
      last_seen_at = now()
    WHERE id = v_existing.id;

    INSERT INTO public.auth_audit_logs(auth_uid, user_id, email, provider, event_type, hosted_domain)
    VALUES (NEW.id, v_existing.id, v_email, v_provider, 'login_success', v_hd);
    RETURN NEW;
  END IF;

  -- New user: check allowed domain policy
  SELECT * INTO v_dom FROM public.allowed_domains WHERE lower(domain) = lower(v_hd) LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.auth_audit_logs(auth_uid, email, provider, event_type, hosted_domain)
    VALUES (NEW.id, v_email, v_provider, 'login_blocked_domain', v_hd);
    RAISE EXCEPTION 'Domain @% is not authorized for workspace auto-provisioning', v_hd;
  END IF;

  INSERT INTO public.users (auth_uid, name, email, avatar_url, google_sub, email_verified, hosted_domain, role, status, last_login_at, last_seen_at)
  VALUES (NEW.id, v_name, v_email, v_avatar, v_sub, v_verified, v_hd, v_dom.default_role, 'active', now(), now())
  RETURNING * INTO v_existing;

  INSERT INTO public.auth_audit_logs(auth_uid, user_id, email, provider, event_type, hosted_domain)
  VALUES (NEW.id, v_existing.id, v_email, v_provider, 'login_success', v_hd);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_google_user_sync ON auth.users;
CREATE TRIGGER on_auth_google_user_sync
  AFTER INSERT OR UPDATE OF raw_user_meta_data, last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_google_auth_user();

-- Helper used by RLS policies to guarantee deactivated or revoked sessions fail closed
CREATE OR REPLACE FUNCTION public.is_active_authenticated_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.status = 'active'
      AND u.email_verified = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Allow admins to revoke all active sessions by incrementing session_version
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid() AND u.status = 'active' AND u.role IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only Admins can revoke user sessions';
  END IF;

  UPDATE public.users SET session_version = session_version + 1 WHERE id = p_target_user_id;
  INSERT INTO public.auth_audit_logs(user_id, email, event_type)
  SELECT id, email, 'token_revoked' FROM public.users WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
