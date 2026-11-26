import { Fragment, html, useEffect, useState } from '../lib/react.js';
import { ROLES, normRole } from '../config/constants.js';
import {
  hasSupabaseAuth,
  fetchPublicLoginPolicy,
  formatLoginError,
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

const ThemeGlyph = ({ theme = 'dark' }) =>
  theme === 'dark'
    ? html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>`
    : html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.35 14.35A8.5 8.5 0 0 1 9.65 3.65a8.5 8.5 0 1 0 10.7 10.7z" />
      </svg>`;

const LOCAL_DEV_PRESETS = [
  {
    id: 'local-dev-superadmin',
    name: 'Maksym Fedorenko',
    email: 'maf@planit-inc.com',
    role: 'SuperAdmin',
    title: 'Creator of Datum',
    dept: 'VDC',
    provider: 'google',
    emailVerified: true,
    avatar: makeGooglePhotoFallback('Maksym Fedorenko', '#0a84ff'),
  },
];

const SHOWCASE_SLIDES = [
  {
    title: 'Diman High School',
    subtitle: 'Modern Campus Exterior · BIM & VDC Standards',
    tag: 'VDC Standards',
    img: 'https://cdn.prod.website-files.com/686d0fd099ee65617e107e24/6ab23b06b375f7dd6e146ffe_exterior_-_front_sunset.1600x0%20(1).webp',
  },
  {
    title: 'Park Summit',
    subtitle: '21-Story Mixed-Use · San Diego Bay',
    tag: 'High-Rise BIM',
    img: 'https://cdn.prod.website-files.com/686d0fd099ee65617e107e24/6a74495628023a5bb1f5876f_General%20View%20(1).jpg',
  },
  {
    title: '1900 Broadway',
    subtitle: 'Urban High-Rise · Architectural Detailing',
    tag: 'Architectural BIM',
    img: 'https://cdn.prod.website-files.com/686d0fd099ee65617e107e24/6aea0b80f817d9be41517d22_Broadway.jpg',
  },
  {
    title: 'The Ritz-Carlton Residences',
    subtitle: 'Vanderbilt Beach, Naples · Waterfront Complex',
    tag: 'Waterfront Residential',
    img: 'https://cdn.prod.website-files.com/686d0fd099ee65617e107e24/6a3e50b6431ffc535712b493_Naples%205.jpg',
  },
];

function resolveActiveTheme() {
  if (typeof document === 'undefined') return 'dark';
  const ds = document.documentElement.dataset.theme;
  if (ds === 'light' || ds === 'dark') return ds;
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function LoginView({ initialError = '', onSignedIn }) {
  const [chooser, setChooser] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(initialError || '');
  const [errCode, setErrCode] = useState('');
  const [themeMode, setThemeMode] = useState(() => resolveActiveTheme());
  const [policy, setPolicy] = useState(() => ({
    enabled: true,
    mode: 'domain_or_whitelist',
    allowGuestPortal: false,
    isLocalDev: false,
  }));
  const [custom, setCustom] = useState({
    name: '',
    email: '',
    avatar: '',
    title: 'Studio Member',
    dept: 'VDC',
  });
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const id = window.setTimeout(() => {
      setSlideIdx((idx) => (idx + 1) % SHOWCASE_SLIDES.length);
    }, 7500);
    return () => window.clearTimeout(id);
  }, [slideIdx]);

  useEffect(() => {
    if (initialError) {
      setErr(initialError);
      setErrCode('');
    }
  }, [initialError]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const sync = () => setThemeMode(resolveActiveTheme());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
    if (mq && mq.addEventListener) mq.addEventListener('change', sync);
    return () => {
      obs.disconnect();
      if (mq && mq.removeEventListener) mq.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchPublicLoginPolicy().then((p) => {
      if (alive && p) setPolicy(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggleLoginTheme = () => {
    if (typeof document === 'undefined') return;
    const current = resolveActiveTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('kb2-theme', JSON.stringify(next));
    } catch (e) {}
    setThemeMode(next);
  };

  const handleServerAuth = async (profile) => {
    setErr('');
    setErrCode('');
    setBusy(true);
    const out = await issueVerifiedSession(profile);
    setBusy(false);
    if (!out.ok) {
      const formatted = formatLoginError(out.error || 'Access denied by workspace policy.', out.code || '');
      setErr(formatted.message);
      setErrCode(out.code || '');
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
      setErrCode('');
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

  const alertObj = err ? formatLoginError(err, errCode) : null;

  const renderAlert = (compact = false) =>
    alertObj
      ? html`<div
          className=${'lgn-alert' + (alertObj.kind === 'neutral' ? ' is-neutral' : '') + (compact ? ' is-compact' : '')}
          role="alert"
        >
          <span className="lgn-alert-ico">
            <${Ic} n=${alertObj.kind === 'neutral' ? 'clock' : 'lock'} s=${15} />
          </span>
          <div className="lgn-alert-body">
            <b>${alertObj.title}</b>
            <p>${alertObj.message}</p>
          </div>
          <button
            type="button"
            className="lgn-alert-x"
            aria-label="Dismiss message"
            onClick=${() => {
              setErr('');
              setErrCode('');
            }}
          >
            <${Ic} n="x" s=${12} />
          </button>
        </div>`
      : null;

  const activeSlide = SHOWCASE_SLIDES[slideIdx] || SHOWCASE_SLIDES[0];
  const prevSlide = () => setSlideIdx((idx) => (idx - 1 + SHOWCASE_SLIDES.length) % SHOWCASE_SLIDES.length);
  const nextSlide = () => setSlideIdx((idx) => (idx + 1) % SHOWCASE_SLIDES.length);

  return html`<div className="lgn-wrap">
    <header className="lgn-head">
      <div className="lgn-top-brand">
        <${DatumMark} s=${24} />
        <span className="lgn-top-name">Datum</span>
      </div>
      <button
        type="button"
        className="lgn-theme-btn"
        title=${themeMode === 'dark' ? 'Switch to Light appearance' : 'Switch to Dark appearance'}
        aria-label=${themeMode === 'dark' ? 'Switch to Light appearance' : 'Switch to Dark appearance'}
        onClick=${toggleLoginTheme}
      >
        <${ThemeGlyph} theme=${themeMode} />
      </button>
    </header>

    <main className="lgn-auth-col">
      <div className="lgn-auth">
        <div className="lgn-kicker">DATUM WORKSPACE</div>
        <h1>Sign in to Datum</h1>
        <p className="lgn-lead">
          Standards, 3D knowledge space, and engineering workflows in one place.
        </p>

        ${renderAlert(false)}

        <div className="lgn-actions">
          <button
            type="button"
            className="gg-btn"
            disabled=${busy}
            onClick=${() => {
              setErr('');
              setErrCode('');
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
            <span className="gg-ico-badge"><${GoogleMark} /></span>
            <span>
              ${busy ? 'Connecting to Google…' : err ? 'Try another Google account' : 'Continue with Google'}
            </span>
            <span className="gg-arrow" aria-hidden="true">→</span>
          </button>

          ${policy.allowGuestPortal &&
          html`<button
            type="button"
            className="btn lgn-guest-btn"
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

        <div className="lgn-note">
          <${Ic} n="lock" s=${12} />
          <span>Invitation-only access · Authorized accounts only</span>
        </div>
      </div>
    </main>

    <footer className="lgn-meta">
      <span>Datum</span>
      <span>BIM · VDC · Standards</span>
    </footer>

    <aside className="lgn-media" aria-label="Architectural showcase">
      <div className="lgn-showcase">
        ${SHOWCASE_SLIDES.map(
          (s, i) =>
            html`<img
              key=${s.img}
              src=${s.img}
              alt=${s.title}
              loading="eager"
              decoding="async"
              className=${'lgn-sc-img' + (i === slideIdx ? ' is-active' : '')}
            />`
        )}
        <div className="lgn-sc-scrim" aria-hidden="true"></div>
        <div className="lgn-sc-top">
          <span className="lgn-sc-pill">${activeSlide.tag}</span>
          <div className="lgn-sc-nav">
            <span className="lgn-sc-count">
              ${String(slideIdx + 1).padStart(2, '0')} / ${String(SHOWCASE_SLIDES.length).padStart(2, '0')}
            </span>
            <button type="button" className="lgn-sc-btn" aria-label="Previous project" onClick=${prevSlide}>‹</button>
            <button type="button" className="lgn-sc-btn" aria-label="Next project" onClick=${nextSlide}>›</button>
          </div>
        </div>
        <div className="lgn-sc-foot">
          <div className="lgn-sc-kicker">FEATURED PROJECT</div>
          <h2 className="lgn-sc-title">${activeSlide.title}</h2>
          <p className="lgn-sc-sub">${activeSlide.subtitle}</p>
          <div className="lgn-sc-bars" role="tablist" aria-label="Featured projects">
            ${SHOWCASE_SLIDES.map(
              (s, i) =>
                html`<button
                  key=${s.title}
                  type="button"
                  role="tab"
                  className=${'lgn-sc-bar' + (i === slideIdx ? ' is-active' : '')}
                  aria-label=${s.title}
                  aria-selected=${i === slideIdx}
                  onClick=${() => setSlideIdx(i)}
                >
                  <span key=${i === slideIdx ? 'run-' + slideIdx : 'idle-' + i}></span>
                </button>`
            )}
          </div>
        </div>
      </div>
    </aside>

    ${chooser &&
    policy.isLocalDev &&
    html`<div>
      <div className="ov" style=${{ zIndex: 95 }} onClick=${() => setChooser(false)}></div>
      <div className="pdl-modal gg-modal" role="dialog" aria-modal="true" aria-label="Sign in with Google">
        <button className="x" aria-label="Close" onClick=${() => setChooser(false)}><${Ic} n="x" s=${14} /></button>
        <div className="gg-head">
          <${GoogleMark} />
          <div>
            <h3>${customMode ? 'Verify Email Against Allowlist' : 'Local Development Sign-In'}</h3>
            <small>Server validates every sign-in against live workspace access rules</small>
          </div>
        </div>

        ${renderAlert(true)}

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
                  setErrCode('');
                  setCustomMode(true);
                }}
              >
                <div className="av" style=${{ background: 'var(--fill2)', color: 'var(--text)' }}><${Ic} n="plus" s=${15} /></div>
                <div className="gg-acc-t">
                  <b>Test or sign in with another email</b>
                  <small>Tests real server-side allowlist & domain verification</small>
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
                  <span>Full Name <em style=${{ fontStyle: 'normal', opacity: 0.6 }}>(optional)</em></span>
                  <input
                    className="inp"
                    placeholder="e.g. Taras Kovalenko"
                    value=${custom.name}
                    onChange=${(e) => setCustom({ ...custom, name: e.target.value })}
                  />
                </label>
                <label className="pdl-field">
                  <span>Email</span>
                  <input
                    className="inp"
                    type="email"
                    placeholder="name@company.com"
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
                    setErrCode('');
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
