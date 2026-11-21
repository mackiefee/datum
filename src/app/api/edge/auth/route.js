import {
  DEFAULT_ACCESS_POLICY,
  authenticateEdgeRequest,
  evaluateAccessPolicy,
  fetchServerAccessPolicy,
  getSupabaseAdmin,
  isAdminRole,
  isStrictLocalhostDev,
  lookupDbUser,
  mapDbRole,
  normalizeAccessPolicy,
  revokeUnauthorizedAutoProvision,
  saveServerAccessPolicy,
  signHmacJwt,
  toPublicLoginPolicy,
  verifyGoogleIdToken,
  verifyHmacJwt,
  verifySupabaseOAuthJwt,
  writeAuthAuditLog,
} from '../../../../lib/edgeAuth.js';

export const runtime = 'edge';

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req) {
  const admin = getSupabaseAdmin();
  const policy = await fetchServerAccessPolicy(admin, { force: true });
  return jsonResp({
    ok: true,
    policy: {
      ...toPublicLoginPolicy(policy),
      isLocalDev: isStrictLocalhostDev(req),
    },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action = 'issue', profile, token, idToken } = body || {};
    const admin = getSupabaseAdmin();

    if (action === 'verify') {
      const checked = await verifyHmacJwt(token);
      if (!checked.valid || !checked.claims) {
        return jsonResp({ valid: false, reason: checked.reason || 'Invalid token' }, 401);
      }
      if (checked.claims.scope === 'revit_lookup_only') {
        return jsonResp(
          { valid: false, accessDenied: true, code: 'SCOPE_FORBIDDEN', reason: 'Revit plugin token cannot access web session' },
          403
        );
      }
      const policy = await fetchServerAccessPolicy(admin, { force: true });
      const email = String(checked.claims.email || '').trim().toLowerCase();
      const isGuest = checked.claims.provider === 'guest' || checked.claims.role === 'Guest' || checked.claims.role === 'guest';
      const dbUser = !isGuest && email ? await lookupDbUser(admin, email) : null;

      if (dbUser && checked.claims.sv && Number(dbUser.session_version || 1) > Number(checked.claims.sv)) {
        return jsonResp({ valid: false, accessDenied: true, code: 'SESSION_REVOKED', reason: 'Session revoked' }, 401);
      }

      const verdict = evaluateAccessPolicy({ email, isGuest, dbUser, policy });
      if (!verdict.allowed) {
        if (dbUser) {
          await revokeUnauthorizedAutoProvision(admin, dbUser, policy);
        }
        return jsonResp(
          { valid: false, accessDenied: true, code: verdict.code, reason: verdict.reason },
          403
        );
      }

      return jsonResp({
        valid: true,
        claims: {
          ...checked.claims,
          role: mapDbRole(verdict.effectiveRole || (dbUser && dbUser.role), checked.claims.role || (isGuest ? 'Guest' : 'Member')),
        },
        policy: {
          ...toPublicLoginPolicy(policy),
          isLocalDev: isStrictLocalhostDev(req),
        },
      });
    }

    if (action === 'verify_supabase_token') {
      if (!token) {
        return jsonResp({ ok: false, error: 'Supabase OAuth token is required' }, 400);
      }
      const supaProfile = await verifySupabaseOAuthJwt(admin, token);
      if (!supaProfile) {
        return jsonResp({ ok: false, error: 'Invalid or unverified Supabase OAuth token' }, 401);
      }

      const [dbUser, policy] = await Promise.all([
        lookupDbUser(admin, supaProfile.email),
        fetchServerAccessPolicy(admin, { force: true }),
      ]);

      const verdict = evaluateAccessPolicy({
        email: supaProfile.email,
        isGuest: false,
        dbUser,
        policy,
      });

      if (!verdict.allowed) {
        if (dbUser) {
          await revokeUnauthorizedAutoProvision(admin, dbUser, policy);
        }
        await writeAuthAuditLog(admin, {
          email: supaProfile.email,
          provider: 'google',
          event_type: verdict.code === 'ACCOUNT_DEACTIVATED' ? 'login_blocked_deactivated' : 'login_blocked_whitelist',
          hosted_domain: supaProfile.hd,
          metadata: { google_sub: supaProfile.sub, code: verdict.code, reason: verdict.reason, source: 'oauth' },
        });
        return jsonResp(
          {
            ok: false,
            accessDenied: true,
            code: verdict.code,
            error: verdict.reason,
          },
          403
        );
      }

      const claims = {
        sub: supaProfile.sub,
        email: supaProfile.email,
        name: (dbUser && dbUser.name) || supaProfile.name,
        avatar: supaProfile.avatar || '',
        hd: supaProfile.hd || supaProfile.email.split('@')[1] || '',
        provider: 'google',
        emailVerified: true,
        role: mapDbRole(verdict.effectiveRole || (dbUser && dbUser.role), 'Member'),
        sv: (dbUser && dbUser.session_version) || 1,
        iat: Date.now(),
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
      };
      const signedToken = await signHmacJwt(claims);
      await writeAuthAuditLog(admin, {
        email: supaProfile.email,
        user_id: dbUser ? dbUser.id : null,
        provider: 'google',
        event_type: 'login_success',
        hosted_domain: claims.hd,
        metadata: { google_sub: claims.sub, source: 'oauth', matched_rule: verdict.matchedRule },
      });
      return jsonResp({
        ok: true,
        claims,
        token: signedToken,
        policy: toPublicLoginPolicy(policy),
      });
    }

    if (action === 'get_policy') {
      const auth = await authenticateEdgeRequest(req, admin, { forcePolicyRefresh: true });
      if (!auth.ok) {
        return jsonResp({ ok: false, error: auth.error, accessDenied: auth.accessDenied, code: auth.code }, auth.status);
      }
      if (!isAdminRole(auth.caller.role)) {
        return jsonResp({ ok: false, error: 'Administrator privileges required to inspect full access policy' }, 403);
      }
      return jsonResp({ ok: true, policy: auth.policy });
    }

    if (action === 'save_policy') {
      const auth = await authenticateEdgeRequest(req, admin, { forcePolicyRefresh: true });
      if (!auth.ok) {
        return jsonResp({ ok: false, error: auth.error, accessDenied: auth.accessDenied, code: auth.code }, auth.status);
      }
      if (auth.caller.role !== 'super_admin') {
        return jsonResp({ ok: false, error: 'Only SuperAdmin can modify workspace whitelist & access policy' }, 403);
      }
      const saved = await saveServerAccessPolicy(admin, body.policy || {}, auth.caller.email);
      await writeAuthAuditLog(admin, {
        email: auth.caller.email,
        user_id: auth.caller.id,
        provider: 'google',
        event_type: 'access_policy_updated',
        metadata: {
          enabled: saved.enabled,
          mode: saved.mode,
          allowedDomains: saved.allowedDomains,
          allowedEmailsCount: saved.allowedEmails.length,
          blockedEmailsCount: saved.blockedEmails.length,
          allowGuestPortal: saved.allowGuestPortal,
          autoApproveDomainUsers: saved.autoApproveDomainUsers,
        },
      });
      return jsonResp({ ok: true, policy: saved });
    }

    if (action === 'simulate_access') {
      const auth = await authenticateEdgeRequest(req, admin, { forcePolicyRefresh: true });
      if (!auth.ok) {
        return jsonResp({ ok: false, error: auth.error, accessDenied: auth.accessDenied, code: auth.code }, auth.status);
      }
      if (!isAdminRole(auth.caller.role)) {
        return jsonResp({ ok: false, error: 'Administrator privileges required' }, 403);
      }
      const targetEmail = String(body.email || '').trim().toLowerCase();
      const targetIsGuest = Boolean(body.isGuest);
      const dbUser = !targetIsGuest && targetEmail ? await lookupDbUser(admin, targetEmail) : null;
      const draftPolicy = body.policy ? normalizeAccessPolicy(body.policy) : auth.policy || DEFAULT_ACCESS_POLICY;
      const verdict = evaluateAccessPolicy({
        email: targetEmail,
        isGuest: targetIsGuest,
        dbUser,
        policy: draftPolicy,
      });
      return jsonResp({ ok: true, verdict, inDirectory: Boolean(dbUser), directoryStatus: dbUser ? dbUser.status : null });
    }

    // action === 'issue': Session issuance from Google ID token or strict localhost development
    const isGuest = profile && profile.provider === 'guest';
    const policy = await fetchServerAccessPolicy(admin, { force: true });

    if (isGuest) {
      const email = String(profile?.email || 'partner@client.example').trim().toLowerCase();
      const verdict = evaluateAccessPolicy({ email, isGuest: true, dbUser: null, policy });
      if (!verdict.allowed) {
        return jsonResp(
          { ok: false, accessDenied: true, code: verdict.code, error: verdict.reason },
          403
        );
      }
      const claims = {
        sub: profile.googleSub || `guest-${Date.now()}`,
        email,
        name: String(profile.name || 'External Partner').trim(),
        avatar: profile.avatar || '',
        hd: email.split('@')[1] || '',
        provider: 'guest',
        emailVerified: false,
        role: 'Guest',
        sv: 1,
        iat: Date.now(),
        exp: Date.now() + 1000 * 60 * 60 * 12,
      };
      const signedToken = await signHmacJwt(claims);
      return jsonResp({ ok: true, claims, token: signedToken, policy: toPublicLoginPolicy(policy) });
    }

    let verifiedProfile = null;
    if (idToken) {
      verifiedProfile = await verifyGoogleIdToken(idToken);
      if (!verifiedProfile) {
        return jsonResp({ ok: false, accessDenied: true, code: 'INVALID_GOOGLE_TOKEN', error: 'Google ID token verification failed' }, 401);
      }
    } else if (isStrictLocalhostDev(req)) {
      if (!profile || !profile.email) {
        return jsonResp({ ok: false, error: 'Email is required' }, 400);
      }
      verifiedProfile = {
        sub: profile.googleSub || `local-${Date.now()}`,
        email: String(profile.email).trim().toLowerCase(),
        name: String(profile.name || String(profile.email).split('@')[0]).trim(),
        avatar: profile.avatar || '',
        hd: String(profile.email).trim().toLowerCase().split('@')[1] || '',
        emailVerified: profile.emailVerified !== false,
      };
    } else {
      return jsonResp(
        {
          ok: false,
          accessDenied: true,
          code: 'OAUTH_REQUIRED',
          error: 'Direct profile login is disabled in production. Sign in via Google OAuth.',
        },
        403
      );
    }

    const email = verifiedProfile.email;
    const domain = email.split('@')[1] || '';

    if (verifiedProfile.emailVerified === false) {
      return jsonResp({ ok: false, accessDenied: true, code: 'UNVERIFIED_EMAIL', error: 'Security block: Google account email must be verified.' }, 403);
    }

    const dbUser = await lookupDbUser(admin, email);
    if (profile?.status === 'deactivated' && !(dbUser && dbUser.role === 'super_admin')) {
      return jsonResp({ ok: false, accessDenied: true, code: 'ACCOUNT_DEACTIVATED', error: 'Account deactivated by administrator.' }, 403);
    }

    const verdict = evaluateAccessPolicy({
      email,
      isGuest: false,
      dbUser,
      policy,
    });

    if (!verdict.allowed) {
      await writeAuthAuditLog(admin, {
        email,
        provider: 'google',
        event_type: verdict.code === 'ACCOUNT_DEACTIVATED' ? 'login_blocked_deactivated' : 'login_blocked_whitelist',
        hosted_domain: domain,
        metadata: { code: verdict.code, reason: verdict.reason, source: 'edge_session' },
      });
      return jsonResp(
        { ok: false, accessDenied: true, code: verdict.code, error: verdict.reason },
        403
      );
    }

    const claims = {
      sub: verifiedProfile.sub || `g-${Date.now()}`,
      email,
      name: (dbUser && dbUser.name) || verifiedProfile.name,
      avatar: verifiedProfile.avatar || '',
      hd: verifiedProfile.hd || domain,
      provider: 'google',
      emailVerified: true,
      role: mapDbRole(verdict.effectiveRole || (dbUser && dbUser.role), 'Member'),
      sv: (dbUser && dbUser.session_version) || 1,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };

    const signedToken = await signHmacJwt(claims);
    await writeAuthAuditLog(admin, {
      email,
      user_id: dbUser ? dbUser.id : null,
      provider: claims.provider,
      event_type: 'login_success',
      hosted_domain: domain,
      metadata: { google_sub: claims.sub, source: 'edge_session', matched_rule: verdict.matchedRule },
    });

    return jsonResp({
      ok: true,
      claims,
      token: signedToken,
      policy: toPublicLoginPolicy(policy),
    });
  } catch (err) {
    return jsonResp({ ok: false, error: String(err) }, 500);
  }
}
