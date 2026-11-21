import { Fragment, html, useEffect, useMemo, useState } from '../../lib/react.js';
import { ROLES, normRole } from '../../config/constants.js';
import {
  ACCESS_MODES,
  DEFAULT_ACCESS_POLICY,
  PUBLIC_CONSUMER_DOMAINS,
  evaluateAccessPolicy,
  normalizeAccessPolicy,
  normalizeDomain,
  normalizeEmail,
} from '../../lib/accessPolicy.js';
import { db } from '../../lib/db.js';
import { Ic } from '../../components/Icon.js';
import { Avatar } from '../../components/Badge.js';
import { ROLE_COL } from '../../components/UserDirectoryModals.js';

const SUPABASE_RLS_SQL_PATCH = `-- Datum Ultra: Zero-Trust Supabase Trigger & RLS Patch (0010_access_policy_rls.sql)
DELETE FROM public.allowed_domains WHERE lower(domain) = 'gmail.com';
CREATE OR REPLACE FUNCTION public.can_read_public_portal() RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT (data->>'allowGuestPortal')::boolean FROM public.shared_workspace_meta WHERE key = 'access_policy' LIMIT 1), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
-- See full migration file in repository: supabase/migrations/0010_access_policy_rls.sql`;

function policyEquals(a, b) {
  const x = normalizeAccessPolicy(a);
  const y = normalizeAccessPolicy(b);
  return (
    x.enabled === y.enabled &&
    x.mode === y.mode &&
    x.includeDirectoryInWhitelist === y.includeDirectoryInWhitelist &&
    x.requireDirectoryMembership === y.requireDirectoryMembership &&
    x.autoApproveDomainUsers === y.autoApproveDomainUsers &&
    x.allowGuestPortal === y.allowGuestPortal &&
    x.allowRevitPlugin === y.allowRevitPlugin &&
    JSON.stringify(x.allowedDomains) === JSON.stringify(y.allowedDomains) &&
    JSON.stringify(x.allowedEmails) === JSON.stringify(y.allowedEmails) &&
    JSON.stringify(x.blockedEmails) === JSON.stringify(y.blockedEmails)
  );
}

const RULE_SWITCH = ({ label, desc, checked, disabled, onToggle }) => html`<div className="cd-row is-inset-0 aw-rule-row">
  <div className="cd-row-tx">
    <span className="cd-row-name">${label}</span>
    <div className="cd-row-s" style=${{ whiteSpace: 'normal' }}>${desc}</div>
  </div>
  <div className="cd-row-end">
    <button
      type="button"
      role="switch"
      aria-checked=${Boolean(checked)}
      aria-label=${label}
      disabled=${disabled}
      className=${'aw-switch' + (checked ? ' on' : '')}
      onClick=${() => !disabled && onToggle(!checked)}
    >
      <span className="aw-switch-thumb" />
    </button>
  </div>
</div>`;

export function AccessWhitelistTab({
  policy,
  users = [],
  isSuperAdmin = false,
  currentUserEmail = '',
  onSavePolicy,
  flash,
}) {
  const normalizedServer = useMemo(() => normalizeAccessPolicy(policy || DEFAULT_ACCESS_POLICY), [policy]);
  const [draft, setDraft] = useState(normalizedServer);
  const [saving, setSaving] = useState(false);

  const [domainInput, setDomainInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [blockedInput, setBlockedInput] = useState('');

  const [simEmail, setSimEmail] = useState('');
  const [simIsGuest, setSimIsGuest] = useState(false);
  const [serverSim, setServerSim] = useState(null);
  const [busySim, setBusySim] = useState(false);

  useEffect(() => {
    setDraft(normalizedServer);
  }, [normalizedServer]);

  const dirty = useMemo(() => !policyEquals(draft, normalizedServer), [draft, normalizedServer]);
  const activeModeMeta = ACCESS_MODES.find((m) => m.id === draft.mode) || ACCESS_MODES[2];

  const usersByEmail = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      const em = normalizeEmail(u.email || '');
      if (em) map.set(em, u);
    });
    return map;
  }, [users]);

  const directoryCoverage = useMemo(() => {
    const list = users.map((u) => {
      const dbUser = {
        id: u.id,
        email: u.email,
        role:
          normRole(u.role) === 'SuperAdmin'
            ? 'super_admin'
            : normRole(u.role) === 'Admin'
            ? 'admin'
            : normRole(u.role) === 'Editor'
            ? 'editor'
            : normRole(u.role) === 'Guest'
            ? 'guest'
            : 'member',
        status: u.status || 'active',
      };
      const verdict = evaluateAccessPolicy({
        email: u.email,
        isGuest: normRole(u.role) === 'Guest',
        dbUser,
        policy: draft,
      });
      return { user: u, verdict };
    });
    const allowedCount = list.filter((x) => x.verdict.allowed).length;
    return { list, allowedCount, total: list.length };
  }, [users, draft]);

  const liveSimPreview = useMemo(() => {
    const clean = normalizeEmail(simEmail);
    if (!simIsGuest && !clean) return null;
    const matched = clean ? usersByEmail.get(clean) : null;
    const dbUser = matched
      ? {
          id: matched.id,
          email: matched.email,
          role:
            normRole(matched.role) === 'SuperAdmin'
              ? 'super_admin'
              : normRole(matched.role) === 'Admin'
              ? 'admin'
              : normRole(matched.role) === 'Editor'
              ? 'editor'
              : normRole(matched.role) === 'Guest'
              ? 'guest'
              : 'member',
          status: matched.status || 'active',
        }
      : null;
    return evaluateAccessPolicy({
      email: clean,
      isGuest: simIsGuest,
      dbUser,
      policy: draft,
    });
  }, [simEmail, simIsGuest, usersByEmail, draft]);

  const filteredAllowedEmails = useMemo(() => {
    const q = emailSearch.trim().toLowerCase();
    return (draft.allowedEmails || []).filter((em) => {
      if (!q) return true;
      const u = usersByEmail.get(em);
      return em.includes(q) || (u && String(u.name || '').toLowerCase().includes(q));
    });
  }, [draft.allowedEmails, emailSearch, usersByEmail]);

  const handleSave = async (nextDraft = draft) => {
    if (!isSuperAdmin || !onSavePolicy || saving) return;
    setSaving(true);
    try {
      const saved = await onSavePolicy(normalizeAccessPolicy(nextDraft));
      if (saved) setDraft(normalizeAccessPolicy(saved));
    } finally {
      setSaving(false);
    }
  };

  const addDomain = () => {
    if (!isSuperAdmin) return;
    const clean = normalizeDomain(domainInput);
    if (!clean) {
      flash && flash('Enter a valid domain (e.g. planit-inc.com)');
      return;
    }
    if (draft.allowedDomains.includes(clean)) {
      setDomainInput('');
      return;
    }
    setDraft((prev) => ({ ...prev, allowedDomains: [...prev.allowedDomains, clean] }));
    setDomainInput('');
  };

  const removeDomain = (dom) => {
    if (!isSuperAdmin) return;
    setDraft((prev) => ({
      ...prev,
      allowedDomains: prev.allowedDomains.filter((d) => d !== dom),
    }));
  };

  const addAllowedEmail = () => {
    if (!isSuperAdmin) return;
    const clean = normalizeEmail(emailInput);
    if (!clean) {
      flash && flash('Enter a valid email address');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      allowedEmails: prev.allowedEmails.includes(clean) ? prev.allowedEmails : [...prev.allowedEmails, clean],
      blockedEmails: prev.blockedEmails.filter((b) => b !== clean),
    }));
    setEmailInput('');
  };

  const removeAllowedEmail = (em) => {
    if (!isSuperAdmin) return;
    if (normalizeEmail(currentUserEmail) === em) {
      flash && flash('You cannot remove your own active SuperAdmin email');
      return;
    }
    const usr = usersByEmail.get(em);
    if (usr && normRole(usr.role) === 'SuperAdmin') {
      flash && flash('SuperAdmin accounts keep fail-safe access unless deactivated');
    }
    setDraft((prev) => ({
      ...prev,
      allowedEmails: prev.allowedEmails.filter((e) => e !== em),
    }));
  };

  const addBlockedEmail = (rawTarget = blockedInput) => {
    if (!isSuperAdmin) return;
    const clean = normalizeEmail(rawTarget);
    if (!clean) {
      flash && flash('Enter a valid email address to block');
      return;
    }
    const usr = usersByEmail.get(clean);
    if (usr && normRole(usr.role) === 'SuperAdmin') {
      flash && flash('SuperAdmin accounts cannot be placed on the email blocklist');
      return;
    }
    if (normalizeEmail(currentUserEmail) === clean) {
      flash && flash('You cannot block your own SuperAdmin email');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      blockedEmails: prev.blockedEmails.includes(clean) ? prev.blockedEmails : [...prev.blockedEmails, clean],
      allowedEmails: prev.allowedEmails.filter((e) => e !== clean),
    }));
    if (rawTarget === blockedInput) setBlockedInput('');
  };

  const removeBlockedEmail = (em) => {
    if (!isSuperAdmin) return;
    setDraft((prev) => ({
      ...prev,
      blockedEmails: prev.blockedEmails.filter((e) => e !== em),
    }));
  };

  const syncActiveDirectoryEmails = () => {
    if (!isSuperAdmin) return;
    const activeEmails = users
      .filter((u) => u.status !== 'deactivated' && normRole(u.role) !== 'Guest' && normalizeEmail(u.email))
      .map((u) => normalizeEmail(u.email));
    setDraft((prev) => ({
      ...prev,
      allowedEmails: [...new Set([...prev.allowedEmails, ...activeEmails])],
    }));
    flash && flash(`Synced ${activeEmails.length} active directory emails into whitelist`);
  };

  const runServerSimulator = async (targetEmail = simEmail, targetGuest = simIsGuest) => {
    setBusySim(true);
    setServerSim(null);
    try {
      const res = await fetch('/api/edge/auth', {
        method: 'POST',
        headers: db.directory.headersFor(currentUserEmail),
        cache: 'no-store',
        body: JSON.stringify({
          action: 'simulate_access',
          email: normalizeEmail(targetEmail),
          isGuest: Boolean(targetGuest),
          policy: draft,
        }),
      });
      const out = await res.json().catch(() => null);
      if (res.ok && out && out.verdict) {
        setServerSim(out);
      } else {
        flash && flash(out?.error || 'Simulator check failed');
      }
    } catch (e) {
      flash && flash('Could not reach auth simulator endpoint');
    } finally {
      setBusySim(false);
    }
  };

  return html`<${Fragment}>
    <section className="cd-card aw-banner">
      <div className="aw-banner-top">
        <div className="aw-banner-l">
          <div className=${'aw-shield ' + (draft.enabled ? 'on' : 'off')}>
            <${Ic} n="shield" s=${18} />
          </div>
          <div>
            <div className="aw-banner-title">
              <b>Whitelist & Zero-Trust Access Control</b>
              <span className=${'aw-status-pill ' + (draft.enabled ? 'on' : 'warn')}>
                ${draft.enabled ? 'Enforced' : 'Strict Whitelist OFF'}
              </span>
              ${!isSuperAdmin && html`<span className="cd-tag">Read-only (SuperAdmin only)</span>`}
            </div>
            <p className="aw-banner-sub">
              Controls Google OAuth sign-in, workspace API routes (/api/workspace, /api/users, /api/brain, Edge AI), and Revit add-in access.
              ${normalizedServer.updatedAt
                ? ` Last saved ${String(normalizedServer.updatedAt).slice(0, 10)}${normalizedServer.updatedBy ? ` by ${normalizedServer.updatedBy}` : ''}.`
                : ''}
            </p>
          </div>
        </div>
        <div className="aw-banner-r">
          <button
            type="button"
            role="switch"
            aria-checked=${draft.enabled}
            aria-label="Enable Strict Whitelist & Access Control"
            disabled=${!isSuperAdmin}
            className=${'aw-switch lg' + (draft.enabled ? ' on' : '')}
            onClick=${() => isSuperAdmin && setDraft((prev) => ({ ...prev, enabled: !prev.enabled }))}
          >
            <span className="aw-switch-thumb" />
          </button>
          ${isSuperAdmin &&
          html`<div className="aw-save-acts">
            ${dirty &&
            html`<button
              type="button"
              className="btn sm"
              disabled=${saving}
              onClick=${() => setDraft(normalizedServer)}
            >
              Reset
            </button>`}
            <button
              type="button"
              className=${'btn sm ' + (dirty ? 'p' : '')}
              disabled=${saving || !dirty}
              onClick=${() => handleSave(draft)}
            >
              ${saving ? 'Saving…' : dirty ? 'Save Policy' : 'Saved'}
            </button>
          </div>`}
        </div>
      </div>
    </section>

    <div className="cd-kpi-row">
      <div className="cd-kpi">
        <b style=${{ fontSize: 16, letterSpacing: '-.01em', lineHeight: 1.4 }}>
          ${draft.enabled ? activeModeMeta.shortLabel : 'Open Policy'}
        </b>
        <small>Active Mode</small>
      </div>
      <div className="cd-kpi">
        <b>${draft.allowedDomains.length}</b>
        <small>Allowed Domains</small>
      </div>
      <div className="cd-kpi">
        <b>${draft.allowedEmails.length}</b>
        <small>Whitelisted Emails</small>
      </div>
      <div className="cd-kpi">
        <b style=${{ color: directoryCoverage.allowedCount === directoryCoverage.total ? '#30d158' : '#ff9f0a' }}>
          ${directoryCoverage.allowedCount}/${directoryCoverage.total}
        </b>
        <small>Directory Permitted</small>
      </div>
    </div>

    <section className="cd-card">
      <div className="cd-card-h">
        <b>Access Mode</b>
        <small>${draft.enabled ? activeModeMeta.label : 'Whitelist Disabled'}</small>
      </div>
      <div className="aw-mode-grid">
        ${ACCESS_MODES.map((m) => {
          const isOn = draft.mode === m.id;
          return html`<button
            key=${m.id}
            type="button"
            className=${'aw-mode-card' + (isOn ? ' on' : '') + (!draft.enabled ? ' muted' : '')}
            disabled=${!isSuperAdmin}
            onClick=${() => isSuperAdmin && setDraft((prev) => ({ ...prev, mode: m.id, enabled: true }))}
          >
            <div className="aw-mode-top">
              <b>${m.label}</b>
              <span className=${'aw-radio' + (isOn ? ' on' : '')}>
                ${isOn ? html`<${Ic} n="check" s=${11} />` : null}
              </span>
            </div>
            <small>${m.description}</small>
          </button>`;
        })}
      </div>
    </section>

    <div className="cd-grid2">
      <section className="cd-card">
        <div className="cd-card-h">
          <b>Allowed Corporate Domains</b>
          <small>${draft.allowedDomains.length}</small>
        </div>
        ${isSuperAdmin &&
        html`<div className="aw-add-row">
          <input
            type="text"
            className="inp"
            placeholder="Add domain (e.g. planit-inc.com)"
            value=${domainInput}
            onChange=${(e) => setDomainInput(e.target.value)}
            onKeyDown=${(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDomain();
              }
            }}
          />
          <button type="button" className="btn sm p" onClick=${addDomain}>Add</button>
        </div>`}
        ${draft.allowedDomains.length > 0
          ? draft.allowedDomains.map((dom) => {
              const isPublicConsumer = PUBLIC_CONSUMER_DOMAINS.includes(dom);
              return html`<div key=${dom} className="cd-row is-inset-0">
                <div className="cd-row-tx">
                  <div className="cd-row-t">
                    <span className="cd-row-name">@${dom}</span>
                    ${isPublicConsumer && html`<span className="cd-tag warn">Consumer domain</span>`}
                  </div>
                  <div className="cd-row-s">
                    ${isPublicConsumer
                      ? 'Warning: public free email provider'
                      : 'Corporate Google Workspace domain'}
                  </div>
                </div>
                ${isSuperAdmin &&
                html`<div className="cd-row-end">
                  <button
                    type="button"
                    className="btn sm"
                    style=${{ color: '#ff453a' }}
                    onClick=${() => removeDomain(dom)}
                  >
                    Remove
                  </button>
                </div>`}
              </div>`;
            })
          : html`<div className="aw-empty-note">No allowed domains configured. Only explicit whitelist emails can access.</div>`}
      </section>

      <section className="cd-card">
        <div className="cd-card-h">
          <b>Security & Portal Rules</b>
          <small>Zero-Trust Gates</small>
        </div>
        <${RULE_SWITCH}
          label="Include Directory Users in Whitelist"
          desc="When OFF (recommended), only emails explicitly listed in Allowed Emails pass the people whitelist."
          checked=${draft.includeDirectoryInWhitelist}
          disabled=${!isSuperAdmin}
          onToggle=${(val) => setDraft((prev) => ({ ...prev, includeDirectoryInWhitelist: val }))}
        />
        <${RULE_SWITCH}
          label="Auto-Approve New Domain Users"
          desc="Allow anyone with an @AllowedDomain Google email to enter without a prior Directory invite."
          checked=${draft.autoApproveDomainUsers}
          disabled=${!isSuperAdmin}
          onToggle=${(val) => setDraft((prev) => ({ ...prev, autoApproveDomainUsers: val }))}
        />
        <${RULE_SWITCH}
          label="Allow External Guest Portal"
          desc="When OFF (recommended), Guest sign-in and unauthenticated Public/Revit lookups are strictly blocked (403)."
          checked=${draft.allowGuestPortal}
          disabled=${!isSuperAdmin}
          onToggle=${(val) => setDraft((prev) => ({ ...prev, allowGuestPortal: val }))}
        />
        <${RULE_SWITCH}
          label="Allow Revit Plugin API Access"
          desc="Enables /api/revit/auth and /api/revit/lookup for authorized whitelist users."
          checked=${draft.allowRevitPlugin}
          disabled=${!isSuperAdmin}
          onToggle=${(val) => setDraft((prev) => ({ ...prev, allowRevitPlugin: val }))}
        />
      </section>
    </div>

    <div className="cd-grid2">
      <section className="cd-card">
        <div className="cd-card-h">
          <b>Whitelisted People (Allowed Emails)</b>
          <div style=${{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <small>${draft.allowedEmails.length}</small>
            ${isSuperAdmin &&
            html`<button
              type="button"
              className="mn"
              style=${{ fontSize: 11.5 }}
              onClick=${syncActiveDirectoryEmails}
            >
              + Sync Directory
            </button>`}
          </div>
        </div>
        ${isSuperAdmin &&
        html`<div className="aw-add-row">
          <input
            type="email"
            className="inp"
            placeholder="Whitelist specific email (e.g. partner@studio.com)"
            value=${emailInput}
            onChange=${(e) => setEmailInput(e.target.value)}
            onKeyDown=${(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAllowedEmail();
              }
            }}
          />
          <button type="button" className="btn sm p" onClick=${addAllowedEmail}>Allow</button>
        </div>`}
        ${draft.allowedEmails.length > 5 &&
        html`<div className="aw-add-row" style=${{ paddingTop: 0 }}>
          <input
            type="search"
            className="inp"
            placeholder="Filter whitelisted emails…"
            value=${emailSearch}
            onChange=${(e) => setEmailSearch(e.target.value)}
          />
        </div>`}
        <div className="aw-scroll-list">
          ${filteredAllowedEmails.length > 0
            ? filteredAllowedEmails.map((em) => {
                const usr = usersByEmail.get(em);
                const rKey = usr ? normRole(usr.role) : '';
                const isRoot = rKey === 'SuperAdmin';
                return html`<div key=${em} className="cd-row is-inset-0">
                  <div className="cd-row-tx">
                    <div className="cd-row-t">
                      <span className="cd-row-name">${usr ? `${usr.name} · ${em}` : em}</span>
                      ${isRoot && html`<span className="cd-tag you">SuperAdmin</span>`}
                      ${!usr && html`<span className="cd-tag">External / Pre-approved</span>`}
                    </div>
                    <div className="cd-row-s">
                      ${usr ? `${ROLES[rKey]} · Status: ${usr.status}` : 'Permitted by explicit email whitelist'}
                    </div>
                  </div>
                  ${isSuperAdmin &&
                  normalizeEmail(currentUserEmail) !== em &&
                  html`<div className="cd-row-end">
                    <button
                      type="button"
                      className="btn sm"
                      style=${{ color: '#ff453a' }}
                      onClick=${() => removeAllowedEmail(em)}
                    >
                      Remove
                    </button>
                  </div>`}
                </div>`;
              })
            : html`<div className="aw-empty-note">No matching whitelisted emails.</div>`}
        </div>
      </section>

      <section className="cd-card">
        <div className="cd-card-h">
          <b>Explicit Blocklist (Blocked Emails)</b>
          <small>${draft.blockedEmails.length}</small>
        </div>
        ${isSuperAdmin &&
        html`<div className="aw-add-row">
          <input
            type="email"
            className="inp"
            placeholder="Block specific email immediately…"
            value=${blockedInput}
            onChange=${(e) => setBlockedInput(e.target.value)}
            onKeyDown=${(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addBlockedEmail(blockedInput);
              }
            }}
          />
          <button
            type="button"
            className="btn sm"
            style=${{ color: '#ff453a' }}
            onClick=${() => addBlockedEmail(blockedInput)}
          >
            Block
          </button>
        </div>`}
        <div className="aw-scroll-list">
          ${draft.blockedEmails.length > 0
            ? draft.blockedEmails.map((em) => html`<div key=${em} className="cd-row is-inset-0">
                <div className="cd-row-tx">
                  <div className="cd-row-t">
                    <span className="cd-row-name">${em}</span>
                    <span className="cd-tag off">Blocked (403)</span>
                  </div>
                  <div className="cd-row-s">Denied across Google OAuth, Workspace API, Second Brain & Revit</div>
                </div>
                ${isSuperAdmin &&
                html`<div className="cd-row-end">
                  <button type="button" className="btn sm" onClick=${() => removeBlockedEmail(em)}>Unblock</button>
                </div>`}
              </div>`)
            : html`<div className="aw-empty-note">No explicitly blocked emails. Non-whitelisted emails are already denied when protection is ON.</div>`}
        </div>
      </section>
    </div>

    <section className="cd-card">
      <div className="cd-card-h">
        <b>Live Access & Security Simulator</b>
        <small>Tests exact server & client policy verdict</small>
      </div>
      <div className="aw-sim-box">
        <div className="aw-add-row" style=${{ borderBottom: 0, padding: 0 }}>
          <input
            type="email"
            className="inp"
            placeholder="Enter any email to verify (e.g. outsider@gmail.com)"
            value=${simEmail}
            disabled=${simIsGuest}
            onChange=${(e) => {
              setSimIsGuest(false);
              setSimEmail(e.target.value);
              setServerSim(null);
            }}
          />
          <button
            type="button"
            className="btn sm p"
            disabled=${busySim || (!simIsGuest && !normalizeEmail(simEmail))}
            onClick=${() => runServerSimulator(simEmail, simIsGuest)}
          >
            ${busySim ? 'Testing…' : 'Verify on Server'}
          </button>
        </div>
        <div className="pl-chips-row">
          ${[
            ['maf@planit-inc.com', false, 'maf@planit-inc.com'],
            ['newuser@planit.studio', false, 'newuser@planit.studio'],
            ['outsider@gmail.com', false, 'outsider@gmail.com'],
            ['', true, 'External Guest / Anonymous'],
          ].map(
            ([em, gst, lbl]) => html`<button
              key=${lbl}
              type="button"
              className=${'pl-chip' + (simIsGuest === gst && simEmail === em ? ' on' : '')}
              onClick=${() => {
                setSimIsGuest(gst);
                setSimEmail(em);
                setServerSim(null);
              }}
            >
              ${lbl}
            </button>`
          )}
        </div>
        ${liveSimPreview &&
        html`<div className=${'aw-sim-res ' + (liveSimPreview.allowed ? 'ok' : 'deny')}>
          <div className="aw-sim-head">
            <b>${liveSimPreview.allowed ? 'ALLOWED (200 OK)' : 'BLOCKED (403 Forbidden)'}</b>
            <code>${liveSimPreview.code}</code>
          </div>
          <span>${liveSimPreview.reason}</span>
          ${serverSim &&
          html`<small>
            Live Server Verdict: <b>${serverSim.verdict.allowed ? 'ALLOWED' : 'BLOCKED'}</b> (${serverSim.verdict.code}) · In Supabase Directory: ${serverSim.inDirectory ? `Yes (${serverSim.directoryStatus})` : 'No'}
          </small>`}
        </div>`}
      </div>
    </section>

    <section className="cd-card">
      <div className="cd-card-h">
        <b>Directory Coverage Under Draft Policy</b>
        <small>${directoryCoverage.allowedCount} of ${directoryCoverage.total} permitted</small>
      </div>
      ${directoryCoverage.list.map(({ user: u, verdict }) => {
        const rKey = normRole(u.role);
        return html`<div key=${u.id} className="cd-row">
          <${Avatar} user=${u} size="sm" />
          <div className="cd-row-tx">
            <div className="cd-row-t">
              <span className="cd-row-name">${u.name}</span>
              <span className="cd-role-pill" style=${{ '--c': ROLE_COL[rKey] || '#8e8e93' }}>
                <i />
                ${ROLES[rKey]}
              </span>
            </div>
            <div className="cd-row-s">${u.email} · ${verdict.reason}</div>
          </div>
          <div className="cd-row-end">
            <span className=${'cd-tag ' + (verdict.allowed ? 'you' : 'off')}>
              ${verdict.allowed ? 'Allowed' : 'Blocked'}
            </span>
          </div>
        </div>`;
      })}
    </section>

    <section className="cd-card">
      <div className="cd-card-h">
        <b>Database Trigger & RLS Hardening</b>
        <small>supabase/migrations/0010_access_policy_rls.sql</small>
      </div>
      <div className="cd-row is-inset-0 aw-rule-row">
        <div className="cd-row-tx">
          <span className="cd-row-name">Edge Zero-Trust & Direct PostgREST Protection</span>
          <div className="cd-row-s" style=${{ whiteSpace: 'normal' }}>
            All Next.js API routes enforce this whitelist live via Supabase Service Role. Apply migration 0010 in Supabase Dashboard SQL Editor to also block direct OAuth auto-provisioning and anonymous PostgREST public reads.
          </div>
        </div>
        <div className="cd-row-end">
          <button
            type="button"
            className="btn sm"
            onClick=${() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(SUPABASE_RLS_SQL_PATCH).then(
                  () => flash && flash('Copied Supabase RLS SQL patch reference'),
                  () => flash && flash('Clipboard copy failed')
                );
              }
            }}
          >
            Copy Supabase RLS SQL Patch
          </button>
        </div>
      </div>
    </section>
  </${Fragment}>`;
}
