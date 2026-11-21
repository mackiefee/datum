import { Fragment, html, useEffect, useState } from '../lib/react.js';
import { ROLES, normRole } from '../config/constants.js';
import {
  ACCESS_MODES,
  DEFAULT_ACCESS_POLICY,
  toPublicLoginPolicy,
} from '../lib/accessPolicy.js';
import {
  hasSupabaseAuth,
  fetchPublicLoginPolicy,
  startSupabaseGoogleOAuth,
  issueVerifiedSession,
  makeGooglePhotoFallback,
} from '../lib/auth.js';
import { Ic, DatumMark } from './Icon.js';
import { Avatar } from './Badge.js';

const GoogleMark = () =>
  html`<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.4H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5H1.2v3.1C3.2 21.3 7.3 24 12 24z" />
    <path fill="#FBBC05" d="M5.2 14.2c-.2-.7-.4-1.4-.4-2.2s.2-1.5.4-2.2V6.7H1.2C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.3l4-3.1z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.7l4 3.1c.9-2.9 3.6-5 6.8-5z" />
  </svg>`;

const LOCAL_DEV_PRESETS = [
  {
    id: 'local-dev-superadmin',
    name: 'Maksym Fedorenko',
    email: 'maf@planit-inc.com',
    role: 'SuperAdmin',
    title: 'Head of VDC & BIM Lead',
    dept: 'VDC',
    provider: 'google',
    emailVerified: true,
    avatar: makeGooglePhotoFallback('Maksym Fedorenko', '#0a84ff'),
  },
];

export function LoginView({ initialError = '', onSignedIn }) {
  const [chooser, setChooser] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(initialError || '');
  const [policy, setPolicy] = useState(() => ({
    ...toPublicLoginPolicy(DEFAULT_ACCESS_POLICY),
    isLocalDev: false,
  }));
  const [custom, setCustom] = useState({
    name: '',
    email: '',
    avatar: '',
    title: 'Studio Member',
    dept: 'VDC',
  });

  useEffect(() => {
    if (initialError) setErr(initialError);
  }, [initialError]);

  useEffect(() => {
    let alive = true;
    fetchPublicLoginPolicy().then((p) => {
      if (alive && p) setPolicy(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const modeMeta = ACCESS_MODES.find((m) => m.id === policy.mode) || ACCESS_MODES[2];
  const domainsText =
    Array.isArray(policy.allowedDomains) && policy.allowedDomains.length
      ? policy.allowedDomains.map((d) => `@${d}`).join(', ')
      : 'None';

  const handleServerAuth = async (profile) => {
    setErr('');
    setBusy(true);
    const out = await issueVerifiedSession(profile);
    setBusy(false);
    if (!out.ok) {
      setErr(out.error || 'Access denied by workspace whitelist policy.');
      return;
    }
    onSignedIn && onSignedIn(out.session, profile);
  };

  const submitCustomGoogle = async (e) => {
    e && e.preventDefault && e.preventDefault();
    const cleanEmail = custom.email.trim().toLowerCase();
    const cleanName = custom.name.trim() || cleanEmail.split('@')[0];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErr('Enter a valid Google email address.');
      return;
    }
    const avatarUrl = custom.avatar.trim() || makeGooglePhotoFallback(cleanName, '#0071e3');
    await handleServerAuth({
      name: cleanName,
      email: cleanEmail,
      avatar: avatarUrl,
      title: custom.title.trim() || 'Studio Member',
      dept: custom.dept.trim() || 'VDC',
      provider: 'google',
      emailVerified: true,
      googleSub: 'g-custom-' + cleanEmail.replace(/[^a-z0-9]/g, ''),
    });
  };

  return html`<div className="lgn-wrap">
    <div className="lgn-card">
      <div className="lgn-brand">
        <div className="logo" style=${{ padding: 0, justifyContent: 'center', fontSize: 20 }}>
          <${DatumMark} s=${30} />
          <span>Datum</span>
        </div>
        <h1>Sign in</h1>
      </div>

      ${err &&
      html`<div className="lgn-err" role="alert">
        <${Ic} n="shield" s=${16} />
        <span>${err}</span>
      </div>`}

      <div className="lgn-actions">
        <button
          type="button"
          className="gg-btn"
          disabled=${busy}
          onClick=${() => {
            setErr('');
            if (policy.isLocalDev) {
              setChooser(true);
              setCustomMode(false);
              return;
            }
            if (hasSupabaseAuth) {
              setBusy(true);
              const out = startSupabaseGoogleOAuth();
              if (out && out.redirected) return;
              setBusy(false);
            }
            setChooser(true);
            setCustomMode(false);
          }}
        >
          <${GoogleMark} />
          <span>${busy ? 'Redirecting to Google…' : 'Continue with Google'}</span>
        </button>

        ${policy.allowGuestPortal &&
        html`<button
          type="button"
          className="btn"
          style=${{ width: '100%', height: 42, justifyContent: 'center', borderRadius: 12 }}
          disabled=${busy}
          onClick=${() =>
            handleServerAuth({
              id: 'guest-portal',
              name: 'External Partner',
              email: 'partner@client.example',
              role: 'Guest',
              provider: 'guest',
              emailVerified: false,
            })
          }
        >
          <${Ic} n="globe" s=${15} />
          <span>Continue as External Guest</span>
        </button>`}
      </div>

      <div className="lgn-sec">
        <div className="lgn-sec-row">
          <${Ic} n="shield" s=${14} />
          <span>
            ${policy.enabled
              ? html`<${Fragment}><b>${modeMeta.shortLabel}</b>${policy.mode !== 'whitelist_only' ? ` · ${domainsText}` : ' · Invite / Approved emails only'}</${Fragment}>`
              : 'Access Policy: Open (Non-blocked Google accounts)'}
          </span>
        </div>
        <div className="lgn-sec-row">
          <${Ic} n="lock" s=${14} />
          <span>
            ${policy.allowGuestPortal
              ? 'External Guest portal enabled for Approved Public items'
              : 'Strict isolation active — unauthorized emails receive 403'}
          </span>
        </div>
      </div>
    </div>

    ${chooser &&
    policy.isLocalDev &&
    html`<div>
      <div className="ov" style=${{ zIndex: 95 }} onClick=${() => setChooser(false)}></div>
      <div className="pdl-modal gg-modal" role="dialog" aria-modal="true" aria-label="Sign in with Google">
        <button className="x" aria-label="Close" onClick=${() => setChooser(false)}><${Ic} n="x" s=${14} /></button>
        <div className="gg-head">
          <${GoogleMark} />
          <div>
            <h3>${customMode ? 'Verify Email Against Whitelist' : 'Local Dev & Whitelist Sign-In'}</h3>
            <small>Server validates every login against live Supabase access_policy</small>
          </div>
        </div>

        ${err &&
        html`<div className="lgn-err" style=${{ margin: '0 0 12px' }} role="alert">
          <${Ic} n="shield" s=${16} />
          <span>${err}</span>
        </div>`}

        ${!customMode
          ? html`<div className="gg-list">
              ${LOCAL_DEV_PRESETS.map(
                (u) => html`<button
                  key=${u.id}
                  type="button"
                  className="gg-acc"
                  disabled=${busy}
                  onClick=${() => handleServerAuth(u)}
                >
                  <${Avatar} user=${u} />
                  <div className="gg-acc-t">
                    <b>${u.name}</b>
                    <small>${u.email}</small>
                  </div>
                  <span className="pill" style=${{ '--c': '#8e5cf7' }}>${ROLES[normRole(u.role)]}</span>
                </button>`
              )}
              <button
                type="button"
                className="gg-acc gg-other"
                onClick=${() => {
                  setErr('');
                  setCustomMode(true);
                }}
              >
                <div className="av" style=${{ background: 'var(--fill2)', color: 'var(--text)' }}><${Ic} n="plus" s=${15} /></div>
                <div className="gg-acc-t">
                  <b>Test or sign in with another email</b>
                  <small>Tests real server-side whitelist & domain rejection</small>
                </div>
              </button>
              ${hasSupabaseAuth &&
              html`<button
                type="button"
                className="gg-acc gg-other"
                onClick=${() => {
                  setBusy(true);
                  startSupabaseGoogleOAuth();
                }}
              >
                <div className="av" style=${{ background: 'var(--fill2)', color: 'var(--text)' }}><${GoogleMark} /></div>
                <div className="gg-acc-t">
                  <b>Real Google OAuth Redirect</b>
                  <small>Authenticate via Supabase Google provider</small>
                </div>
              </button>`}
            </div>`
          : html`<form onSubmit=${submitCustomGoogle}>
              <div className="pdl-form-grid">
                <label className="pdl-field">
                  <span>Full Name</span>
                  <input
                    className="inp"
                    placeholder="e.g. Taras Kovalenko"
                    value=${custom.name}
                    onChange=${(e) => setCustom({ ...custom, name: e.target.value })}
                    required
                  />
                </label>
                <label className="pdl-field">
                  <span>Email</span>
                  <input
                    className="inp"
                    type="email"
                    placeholder="name@planit-inc.com or test@gmail.com"
                    value=${custom.email}
                    onChange=${(e) => setCustom({ ...custom, email: e.target.value })}
                    required
                  />
                </label>
              </div>
              <div className="btns" style=${{ marginBottom: 0 }}>
                <button type="submit" className="btn p" disabled=${busy}>${busy ? 'Checking Policy…' : 'Verify & Sign In'}</button>
                <button
                  type="button"
                  className="btn"
                  onClick=${() => {
                    setErr('');
                    setCustomMode(false);
                  }}
                >
                  Back
                </button>
              </div>
            </form>`}
      </div>
    </div>`}
  </div>`;
}
