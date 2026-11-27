export const ACCESS_MODES = [
  {
    id: 'whitelist_only',
    label: 'Whitelist Only',
    shortLabel: 'Whitelist Only',
    description: 'Only approved people in Allowed Emails (and active Directory users if enabled).',
  },
  {
    id: 'domain_only',
    label: 'Allowed Domains Only',
    shortLabel: 'Domains Only',
    description: 'Only Google Workspace emails belonging to Allowed Domains.',
  },
  {
    id: 'domain_or_whitelist',
    label: 'Domains or Whitelist',
    shortLabel: 'Domains + Whitelist',
    description: 'Corporate accounts from Allowed Domains OR explicitly whitelisted people.',
  },
  {
    id: 'domain_and_whitelist',
    label: 'Strict Domain & Whitelist',
    shortLabel: 'Strict Domain + List',
    description: 'Must match BOTH an Allowed Domain AND the approved people whitelist.',
  },
];

export const VALID_ACCESS_MODES = new Set(ACCESS_MODES.map((m) => m.id));

export const AI_MODES = [
  {
    id: 'standard',
    label: 'Standard',
    color: '#0a84ff',
    description: 'Clear, helpful BIM & engineering assistant.',
  },
  {
    id: 'rude',
    label: 'Rude',
    color: '#ff453a',
    description: 'Sarcastic, grumpy BIM lead who roasts you while helping.',
  },
  {
    id: 'rude_fandom',
    label: 'Rude + Fandom',
    color: '#ff2d55',
    description: 'Toxic BIM lead obsessed with Anime, K-Pop & K-Dramas + fandom references.',
  },
  {
    id: 'fun',
    label: 'Fun',
    color: '#bf5af2',
    description: 'Playful, witty & energetic with fun metaphors.',
  },
];

export const VALID_AI_MODES = new Set(AI_MODES.map((m) => m.id));

export function normalizeAiMode(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return VALID_AI_MODES.has(s) ? s : 'standard';
}

export function getUserAiMode(policy, email) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return 'standard';
  const map = policy && typeof policy.userAiModes === 'object' ? policy.userAiModes : null;
  return normalizeAiMode(map && map[cleanEmail]);
}

export const PUBLIC_CONSUMER_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'mail.com',
];

export const DEFAULT_ACCESS_POLICY = {
  enabled: true,
  mode: 'domain_or_whitelist',
  allowedDomains: ['planit-inc.com', 'planit.studio'],
  allowedEmails: [
    'maf@planit-inc.com',
    'mr.m.fedorenko@gmail.com',
    'tuanf@planit-inc.com',
    'vitalyik@planit-inc.com',
    'iliak@planit-inc.com',
    'juliya16k@gmail.com',
    'aliumax.fe@gmail.com',
  ],
  blockedEmails: [],
  includeDirectoryInWhitelist: false,
  requireDirectoryMembership: true,
  autoApproveDomainUsers: false,
  allowGuestPortal: false,
  allowRevitPlugin: true,
  userAiModes: {},
  updatedAt: null,
  updatedBy: '',
};

export function normalizeDomain(raw) {
  let s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^@+/, '')
    .split('/')[0]
    .split(':')[0]
    .trim();
  if (!s || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return '';
  return s;
}

export function normalizeEmail(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return '';
  return s;
}

function normalizeList(list, normalizer, fallback = []) {
  if (!Array.isArray(list)) return [...fallback];
  return [...new Set(list.map(normalizer).filter(Boolean))];
}

export function normalizeAccessPolicy(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const mode = VALID_ACCESS_MODES.has(src.mode) ? src.mode : DEFAULT_ACCESS_POLICY.mode;
  return {
    enabled: src.enabled !== undefined ? Boolean(src.enabled) : DEFAULT_ACCESS_POLICY.enabled,
    mode,
    allowedDomains: normalizeList(src.allowedDomains, normalizeDomain, DEFAULT_ACCESS_POLICY.allowedDomains),
    allowedEmails: normalizeList(src.allowedEmails, normalizeEmail, DEFAULT_ACCESS_POLICY.allowedEmails),
    blockedEmails: normalizeList(src.blockedEmails, normalizeEmail, DEFAULT_ACCESS_POLICY.blockedEmails),
    includeDirectoryInWhitelist:
      src.includeDirectoryInWhitelist !== undefined
        ? Boolean(src.includeDirectoryInWhitelist)
        : DEFAULT_ACCESS_POLICY.includeDirectoryInWhitelist,
    requireDirectoryMembership:
      src.requireDirectoryMembership !== undefined
        ? Boolean(src.requireDirectoryMembership)
        : DEFAULT_ACCESS_POLICY.requireDirectoryMembership,
    autoApproveDomainUsers:
      src.autoApproveDomainUsers !== undefined
        ? Boolean(src.autoApproveDomainUsers)
        : DEFAULT_ACCESS_POLICY.autoApproveDomainUsers,
    allowGuestPortal:
      src.allowGuestPortal !== undefined ? Boolean(src.allowGuestPortal) : DEFAULT_ACCESS_POLICY.allowGuestPortal,
    allowRevitPlugin:
      src.allowRevitPlugin !== undefined ? Boolean(src.allowRevitPlugin) : DEFAULT_ACCESS_POLICY.allowRevitPlugin,
    userAiModes: (() => {
      const out = {};
      const rawMap = src.userAiModes && typeof src.userAiModes === 'object' ? src.userAiModes : {};
      Object.entries(rawMap).forEach(([k, v]) => {
        const em = normalizeEmail(k);
        const m = normalizeAiMode(v);
        if (em && m !== 'standard') out[em] = m;
      });
      return out;
    })(),
    updatedAt: src.updatedAt ? String(src.updatedAt) : null,
    updatedBy: src.updatedBy ? String(src.updatedBy).trim().toLowerCase() : '',
  };
}

export function toPublicLoginPolicy(rawPolicy) {
  const p = normalizeAccessPolicy(rawPolicy);
  return {
    enabled: p.enabled,
    mode: p.mode,
    allowedDomains: p.allowedDomains,
    allowGuestPortal: p.allowGuestPortal,
    updatedAt: p.updatedAt,
  };
}

/**
 * Pure access policy evaluator shared across Next.js Edge APIs and SuperAdmin simulator UI.
 */
export function evaluateAccessPolicy({ email = '', isGuest = false, dbUser = null, policy: rawPolicy = null } = {}) {
  const policy = normalizeAccessPolicy(rawPolicy);
  const cleanEmail = normalizeEmail(email);
  const domain = cleanEmail ? cleanEmail.split('@')[1] || '' : '';
  const allowedDomainsSet = new Set(policy.allowedDomains);
  const allowedEmailsSet = new Set(policy.allowedEmails);
  const blockedEmailsSet = new Set(policy.blockedEmails);

  if (dbUser && dbUser.status === 'deactivated') {
    return {
      allowed: false,
      code: 'ACCOUNT_DEACTIVATED',
      reason: 'Your workspace account has been deactivated by an administrator.',
      matchedRule: 'account_status',
      effectiveRole: null,
    };
  }

  const effectiveGuest = Boolean(isGuest || (dbUser && dbUser.role === 'guest'));
  if (effectiveGuest) {
    if (cleanEmail && blockedEmailsSet.has(cleanEmail)) {
      return {
        allowed: false,
        code: 'EMAIL_BLOCKED',
        reason: `Access denied: ${cleanEmail} is explicitly blocked by administrator policy.`,
        matchedRule: 'blockedEmails',
        effectiveRole: null,
      };
    }
    if (!policy.allowGuestPortal) {
      return {
        allowed: false,
        code: 'GUEST_DISABLED',
        reason: 'External Guest portal access is disabled by SuperAdmin policy.',
        matchedRule: 'allowGuestPortal',
        effectiveRole: null,
      };
    }
    return {
      allowed: true,
      code: 'GUEST_PORTAL_ALLOWED',
      reason: 'External Guest read-only portal access is enabled.',
      matchedRule: 'allowGuestPortal',
      effectiveRole: 'guest',
    };
  }

  if (!cleanEmail) {
    return {
      allowed: false,
      code: 'AUTH_REQUIRED',
      reason: 'A verified email address is required.',
      matchedRule: 'email_required',
      effectiveRole: null,
    };
  }

  // Root SuperAdmin fail-safe: active SuperAdmins cannot lock themselves out
  if (dbUser && dbUser.role === 'super_admin') {
    return {
      allowed: true,
      code: 'SUPER_ADMIN_FAILSAFE',
      reason: 'Active SuperAdmin retains fail-safe workspace access.',
      matchedRule: 'super_admin_failsafe',
      effectiveRole: 'super_admin',
    };
  }

  if (blockedEmailsSet.has(cleanEmail)) {
    return {
      allowed: false,
      code: 'EMAIL_BLOCKED',
      reason: `Access denied: ${cleanEmail} is explicitly blocked by administrator policy.`,
      matchedRule: 'blockedEmails',
      effectiveRole: null,
    };
  }

  const resolvedRole = (dbUser && dbUser.role) || 'member';

  if (!policy.enabled) {
    return {
      allowed: true,
      code: 'OPEN_POLICY_ALLOWED',
      reason: 'Strict whitelist protection is currently disabled.',
      matchedRule: 'enabled=false',
      effectiveRole: resolvedRole,
    };
  }

  const isActiveDirectoryMember = Boolean(dbUser && dbUser.status !== 'deactivated' && dbUser.role !== 'guest');
  const inExplicitWhitelist = allowedEmailsSet.has(cleanEmail);
  const personWhitelisted = inExplicitWhitelist || (policy.includeDirectoryInWhitelist && isActiveDirectoryMember);
  const domainMatches = Boolean(domain && allowedDomainsSet.has(domain));
  const domainEligible =
    domainMatches && (policy.autoApproveDomainUsers || !policy.requireDirectoryMembership || isActiveDirectoryMember || inExplicitWhitelist);

  if (policy.mode === 'whitelist_only') {
    if (personWhitelisted) {
      return {
        allowed: true,
        code: 'WHITELIST_MATCH',
        reason: inExplicitWhitelist
          ? `${cleanEmail} is explicitly approved on the SuperAdmin whitelist.`
          : `${cleanEmail} is an active member of the workspace directory.`,
        matchedRule: inExplicitWhitelist ? 'allowedEmails' : 'directory_membership',
        effectiveRole: resolvedRole,
      };
    }
    return {
      allowed: false,
      code: 'NOT_WHITELISTED',
      reason: `Access denied: ${cleanEmail} is not on the approved workspace whitelist.`,
      matchedRule: 'mode=whitelist_only',
      effectiveRole: null,
    };
  }

  if (policy.mode === 'domain_only') {
    if (!domainMatches) {
      return {
        allowed: false,
        code: 'DOMAIN_NOT_ALLOWED',
        reason: `Access denied: domain @${domain || 'unknown'} is not in allowed corporate domains (${policy.allowedDomains.join(', ') || 'none configured'}).`,
        matchedRule: 'allowedDomains',
        effectiveRole: null,
      };
    }
    if (!domainEligible) {
      return {
        allowed: false,
        code: 'DIRECTORY_REQUIRED',
        reason: `Access denied: @${domain} user ${cleanEmail} must be invited to the Directory or Whitelist before signing in.`,
        matchedRule: 'requireDirectoryMembership',
        effectiveRole: null,
      };
    }
    return {
      allowed: true,
      code: 'DOMAIN_MATCH',
      reason: `Verified @${domain} domain meets Allowed Domains policy.`,
      matchedRule: 'mode=domain_only',
      effectiveRole: resolvedRole,
    };
  }

  if (policy.mode === 'domain_and_whitelist') {
    if (!domainMatches) {
      return {
        allowed: false,
        code: 'DOMAIN_NOT_ALLOWED',
        reason: `Strict policy blocked ${cleanEmail}: domain @${domain || 'unknown'} is not in allowed domains.`,
        matchedRule: 'mode=domain_and_whitelist:domain',
        effectiveRole: null,
      };
    }
    if (!personWhitelisted) {
      return {
        allowed: false,
        code: 'NOT_WHITELISTED',
        reason: `Strict policy blocked ${cleanEmail}: @${domain} matches allowed domains, but account is not on the approved people whitelist.`,
        matchedRule: 'mode=domain_and_whitelist:whitelist',
        effectiveRole: null,
      };
    }
    return {
      allowed: true,
      code: 'STRICT_DOMAIN_AND_WHITELIST_MATCH',
      reason: `${cleanEmail} satisfies both Allowed Domain (@${domain}) and People Whitelist requirements.`,
      matchedRule: 'mode=domain_and_whitelist',
      effectiveRole: resolvedRole,
    };
  }

  // Default: 'domain_or_whitelist'
  if (personWhitelisted) {
    return {
      allowed: true,
      code: 'WHITELIST_MATCH',
      reason: inExplicitWhitelist
        ? `${cleanEmail} is explicitly approved on the SuperAdmin whitelist.`
        : `${cleanEmail} is an active member of the workspace directory.`,
      matchedRule: inExplicitWhitelist ? 'allowedEmails' : 'directory_membership',
      effectiveRole: resolvedRole,
    };
  }
  if (domainEligible) {
    return {
      allowed: true,
      code: 'DOMAIN_MATCH',
      reason: `Verified @${domain} account permitted by Allowed Domains rule.`,
      matchedRule: 'allowedDomains',
      effectiveRole: resolvedRole,
    };
  }
  if (domainMatches && !policy.autoApproveDomainUsers && policy.requireDirectoryMembership) {
    return {
      allowed: false,
      code: 'DIRECTORY_REQUIRED',
      reason: `Access denied: @${domain} account ${cleanEmail} is not invited in the Directory or Whitelist yet.`,
      matchedRule: 'requireDirectoryMembership',
      effectiveRole: null,
    };
  }
  return {
    allowed: false,
    code: 'DOMAIN_AND_WHITELIST_DENIED',
    reason: `Access denied: ${cleanEmail} is not on the approved whitelist and @${domain || 'unknown'} is not an allowed domain.`,
    matchedRule: 'mode=domain_or_whitelist',
    effectiveRole: null,
  };
}
