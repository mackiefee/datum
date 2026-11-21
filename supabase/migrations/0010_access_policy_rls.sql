-- ============================================================================
-- Datum Knowledge — 0010 SuperAdmin Access Policy, Whitelist & Zero-Trust RLS
-- Enforces SuperAdmin whitelist / allowed-domain policy directly inside
-- PostgreSQL triggers and RLS policies so blocked or unauthorized accounts
-- cannot auto-provision into public.users or exfiltrate rows via PostgREST.
-- ============================================================================

-- 1) Remove consumer gmail.com from default auto-domain table
DELETE FROM public.allowed_domains WHERE lower(domain) = 'gmail.com';

-- 2) Seed default access_policy in shared_workspace_meta if absent
INSERT INTO public.shared_workspace_meta (key, data, updated_at)
VALUES (
  'access_policy',
  jsonb_build_object(
    'enabled', true,
    'mode', 'domain_or_whitelist',
    'allowedDomains', jsonb_build_array('planit-inc.com', 'planit.studio'),
    'allowedEmails', jsonb_build_array(
      'maf@planit-inc.com',
      'mr.m.fedorenko@gmail.com',
      'tuanf@planit-inc.com',
      'vitalyik@planit-inc.com',
      'iliak@planit-inc.com',
      'juliya16k@gmail.com',
      'aliumax.fe@gmail.com'
    ),
    'blockedEmails', jsonb_build_array(),
    'includeDirectoryInWhitelist', false,
    'requireDirectoryMembership', true,
    'autoApproveDomainUsers', false,
    'allowGuestPortal', false,
    'allowRevitPlugin', true,
    'updatedAt', now()::text,
    'updatedBy', 'system-migration'
  ),
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 3) Centralized SQL policy evaluator mirroring src/lib/accessPolicy.js
CREATE OR REPLACE FUNCTION public.check_workspace_access_policy(
  p_email TEXT,
  p_is_guest BOOLEAN DEFAULT false
)
RETURNS BOOLEAN AS $$
DECLARE
  v_policy JSONB;
  v_enabled BOOLEAN := true;
  v_mode TEXT := 'domain_or_whitelist';
  v_allowed_domains JSONB := '["planit-inc.com","planit.studio"]'::jsonb;
  v_allowed_emails JSONB := '["maf@planit-inc.com","mr.m.fedorenko@gmail.com","tuanf@planit-inc.com","vitalyik@planit-inc.com","iliak@planit-inc.com","juliya16k@gmail.com","aliumax.fe@gmail.com"]'::jsonb;
  v_blocked_emails JSONB := '[]'::jsonb;
  v_include_dir BOOLEAN := false;
  v_req_dir BOOLEAN := true;
  v_auto_approve BOOLEAN := false;
  v_allow_guest BOOLEAN := false;

  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_domain TEXT := split_part(v_email, '@', 2);
  v_user public.users%ROWTYPE;
  v_has_user BOOLEAN := false;
  v_in_whitelist BOOLEAN := false;
  v_in_blocked BOOLEAN := false;
  v_domain_match BOOLEAN := false;
  v_is_active_dir BOOLEAN := false;
  v_person_whitelisted BOOLEAN := false;
  v_domain_eligible BOOLEAN := false;
BEGIN
  SELECT data INTO v_policy
  FROM public.shared_workspace_meta
  WHERE key = 'access_policy'
  LIMIT 1;

  IF v_policy IS NOT NULL THEN
    v_enabled := COALESCE((v_policy->>'enabled')::boolean, true);
    v_mode := COALESCE(NULLIF(trim(v_policy->>'mode'), ''), 'domain_or_whitelist');
    IF jsonb_typeof(v_policy->'allowedDomains') = 'array' THEN
      v_allowed_domains := v_policy->'allowedDomains';
    END IF;
    IF jsonb_typeof(v_policy->'allowedEmails') = 'array' THEN
      v_allowed_emails := v_policy->'allowedEmails';
    END IF;
    IF jsonb_typeof(v_policy->'blockedEmails') = 'array' THEN
      v_blocked_emails := v_policy->'blockedEmails';
    END IF;
    v_include_dir := COALESCE((v_policy->>'includeDirectoryInWhitelist')::boolean, true);
    v_req_dir := COALESCE((v_policy->>'requireDirectoryMembership')::boolean, true);
    v_auto_approve := COALESCE((v_policy->>'autoApproveDomainUsers')::boolean, false);
    v_allow_guest := COALESCE((v_policy->>'allowGuestPortal')::boolean, false);
  END IF;

  IF v_email <> '' THEN
    SELECT * INTO v_user
    FROM public.users
    WHERE lower(email) = v_email
    LIMIT 1;
    v_has_user := FOUND;
  END IF;

  IF v_has_user AND v_user.status = 'deactivated' THEN
    RETURN false;
  END IF;

  IF p_is_guest OR (v_has_user AND v_user.role = 'guest') THEN
    IF v_email <> '' THEN
      SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_blocked_emails) x WHERE lower(trim(x)) = v_email
      ) INTO v_in_blocked;
      IF v_in_blocked THEN RETURN false; END IF;
    END IF;
    RETURN v_allow_guest;
  END IF;

  IF v_email = '' THEN
    RETURN false;
  END IF;

  -- Root SuperAdmin fail-safe
  IF v_has_user AND v_user.role = 'super_admin' THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_blocked_emails) x WHERE lower(trim(x)) = v_email
  ) INTO v_in_blocked;
  IF v_in_blocked THEN
    RETURN false;
  END IF;

  IF NOT v_enabled THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_allowed_emails) x WHERE lower(trim(x)) = v_email
  ) INTO v_in_whitelist;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_allowed_domains) x WHERE lower(trim(x)) = v_domain
  ) INTO v_domain_match;

  v_is_active_dir := v_has_user AND v_user.status <> 'deactivated' AND v_user.role <> 'guest';
  v_person_whitelisted := v_in_whitelist OR (v_include_dir AND v_is_active_dir);
  v_domain_eligible := v_domain_match AND (v_auto_approve OR NOT v_req_dir OR v_is_active_dir OR v_in_whitelist);

  IF v_mode = 'whitelist_only' THEN
    RETURN v_person_whitelisted;
  ELSIF v_mode = 'domain_only' THEN
    RETURN v_domain_eligible;
  ELSIF v_mode = 'domain_and_whitelist' THEN
    RETURN v_domain_match AND v_person_whitelisted;
  ELSE
    RETURN v_person_whitelisted OR v_domain_eligible;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_read_public_portal()
RETURNS BOOLEAN AS $$
  SELECT public.check_workspace_access_policy('', true);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 4) Enforce access policy inside RLS identity helpers
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users
  WHERE auth_uid = (SELECT auth.uid())
    AND status = 'active'
    AND public.check_workspace_access_policy(email, role = 'guest')
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_app_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users
  WHERE auth_uid = (SELECT auth.uid())
    AND status = 'active'
    AND public.check_workspace_access_policy(email, role = 'guest')
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_internal_active_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(public.current_app_user_role() IN ('super_admin', 'admin', 'editor', 'member'), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_active_authenticated_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = (SELECT auth.uid())
      AND u.status = 'active'
      AND u.email_verified = true
      AND public.check_workspace_access_policy(u.email, u.role = 'guest')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 5) Replace public.handle_google_auth_user() so non-whitelisted Google accounts are NEVER auto-inserted
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
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'Google OAuth account must include a valid email address';
  END IF;

  IF NOT v_verified THEN
    RAISE EXCEPTION 'Google account email must be verified';
  END IF;

  SELECT * INTO v_existing FROM public.users WHERE auth_uid = NEW.id OR lower(email) = v_email LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'deactivated' THEN
      RAISE EXCEPTION 'Account % has been deactivated by an administrator', v_email;
    END IF;

    IF NOT public.check_workspace_access_policy(v_email, v_existing.role = 'guest') THEN
      RAISE EXCEPTION 'Access denied: % is blocked by workspace whitelist policy', v_email;
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

  -- Strictly block auto-provisioning unless access_policy permits this email/domain
  IF NOT public.check_workspace_access_policy(v_email, false) THEN
    RAISE EXCEPTION 'Access denied: % is not on the authorized workspace whitelist or allowed domain', v_email;
  END IF;

  INSERT INTO public.users (auth_uid, name, email, avatar_url, google_sub, email_verified, hosted_domain, role, status, last_login_at, last_seen_at)
  VALUES (
    NEW.id,
    v_name,
    v_email,
    v_avatar,
    v_sub,
    v_verified,
    v_hd,
    'member'::user_role,
    'active',
    now(),
    now()
  )
  RETURNING * INTO v_existing;

  INSERT INTO public.auth_audit_logs(auth_uid, user_id, email, provider, event_type, hosted_domain)
  VALUES (NEW.id, v_existing.id, v_email, v_provider, 'login_success', v_hd);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6) Gate Public/Guest portal visibility behind allowGuestPortal policy flag
CREATE OR REPLACE FUNCTION public.can_view_item(p_item_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_status lifecycle_status;
  v_vis visibility_level;
  v_owner_id UUID;
  v_cat_id TEXT;
  v_uid UUID := current_app_user_id();
BEGIN
  SELECT status, visibility, owner_id, category_id
  INTO v_status, v_vis, v_owner_id, v_cat_id
  FROM catalog_items
  WHERE id = p_item_id;

  IF NOT FOUND OR v_status = 'Deleted' THEN RETURN false; END IF;
  IF is_app_admin() THEN RETURN true; END IF;
  IF v_vis = 'Public' AND v_status = 'Approved' AND public.can_read_public_portal() THEN RETURN true; END IF;
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF v_owner_id = v_uid THEN RETURN true; END IF;

  IF v_status <> 'Approved' THEN
    RETURN EXISTS (
      SELECT 1 FROM categories c WHERE c.id = v_cat_id AND c.owner_id = v_uid
    ) OR EXISTS (
      SELECT 1 FROM shares s
      WHERE s.target_type = 'category' AND s.target_id = v_cat_id
        AND s.granted_role IN ('editor', 'category_owner')
        AND ((s.grantee_type = 'user' AND s.grantee_id = v_uid) OR
             (s.grantee_type = 'team' AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = s.grantee_id AND tm.user_id = v_uid)))
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM shares s
    WHERE s.target_type IN ('document', 'resource') AND s.target_id = p_item_id::text
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND (
        (s.grantee_type = 'user' AND s.grantee_id = v_uid) OR
        (s.grantee_type = 'team' AND EXISTS (
          SELECT 1 FROM team_members tm WHERE tm.team_id = s.grantee_id AND tm.user_id = v_uid
        ))
      )
  ) THEN
    RETURN true;
  END IF;

  IF v_vis = 'Restricted' THEN RETURN false; END IF;
  RETURN can_view_category(v_cat_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Collections respect tier and visibility" ON public.collections;
CREATE POLICY "Collections respect tier and visibility" ON public.collections
  FOR SELECT USING (
    public.is_app_admin()
    OR (public.is_internal_active_user() AND owner_id = public.current_app_user_id())
    OR (visibility = 'Public' AND public.can_read_public_portal())
    OR (visibility = 'Internal' AND public.is_internal_active_user())
    OR (
      public.is_internal_active_user()
      AND EXISTS (
        SELECT 1 FROM shares s
        WHERE s.target_type = 'collection' AND s.target_id = collections.id
          AND (s.expires_at IS NULL OR s.expires_at > now())
          AND ((s.grantee_type = 'user' AND s.grantee_id = public.current_app_user_id())
            OR (s.grantee_type = 'team' AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = s.grantee_id AND tm.user_id = public.current_app_user_id())))
      )
    )
  );

DROP POLICY IF EXISTS "shared_catalog_read" ON public.shared_catalog_items;
CREATE POLICY "shared_catalog_read" ON public.shared_catalog_items
  FOR SELECT
  USING (
    (status = 'Approved' AND vis = 'Public' AND public.can_read_public_portal())
    OR public.is_internal_active_user()
  );

DROP POLICY IF EXISTS "shared_collections_read" ON public.shared_collections;
CREATE POLICY "shared_collections_read" ON public.shared_collections
  FOR SELECT
  USING (
    (vis = 'Public' AND public.can_read_public_portal())
    OR (tier IN ('official', 'shared') AND public.is_internal_active_user())
    OR (
      public.is_internal_active_user()
      AND lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  );

DROP POLICY IF EXISTS allowed_domains_read ON public.allowed_domains;
CREATE POLICY allowed_domains_read ON public.allowed_domains
  FOR SELECT TO authenticated
  USING (public.is_internal_active_user());

-- 7) Ensure Second Brain RLS also fails closed when user is blocked by access_policy
DROP POLICY IF EXISTS "personal_tasks_owner_all" ON public.personal_tasks;
CREATE POLICY "personal_tasks_owner_all" ON public.personal_tasks
  FOR ALL
  USING (
    public.is_internal_active_user()
    AND (
      user_id = public.current_app_user_id()
      OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  )
  WITH CHECK (
    public.is_internal_active_user()
    AND (
      user_id = public.current_app_user_id()
      OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  );

DROP POLICY IF EXISTS "personal_notes_owner_all" ON public.personal_notes;
CREATE POLICY "personal_notes_owner_all" ON public.personal_notes
  FOR ALL
  USING (
    public.is_internal_active_user()
    AND (
      user_id = public.current_app_user_id()
      OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  )
  WITH CHECK (
    public.is_internal_active_user()
    AND (
      user_id = public.current_app_user_id()
      OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  );

DROP POLICY IF EXISTS "user_brain_state_owner_all" ON public.user_brain_state;
CREATE POLICY "user_brain_state_owner_all" ON public.user_brain_state
  FOR ALL
  USING (
    public.is_internal_active_user()
    AND (
      user_id = public.current_app_user_id()
      OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  )
  WITH CHECK (
    public.is_internal_active_user()
    AND (
      user_id = public.current_app_user_id()
      OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  );

DROP POLICY IF EXISTS "personal_resources_owner_all" ON public.personal_resources;
CREATE POLICY "personal_resources_owner_all" ON public.personal_resources
  FOR ALL
  USING (
    public.is_internal_active_user()
    AND (
      user_id = public.current_app_user_id()
      OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  )
  WITH CHECK (
    public.is_internal_active_user()
    AND (
      user_id = public.current_app_user_id()
      OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
    )
  );

DROP POLICY IF EXISTS "personal_resources_peer_read" ON public.personal_resources;
CREATE POLICY "personal_resources_peer_read" ON public.personal_resources
  FOR SELECT
  USING (
    public.is_internal_active_user()
    AND shared_with_emails ? lower(COALESCE(auth.jwt()->>'email', ''))
  );

NOTIFY pgrst, 'reload schema';
