import { html } from '../../lib/react.js';

export const EW_TBL =
  '<div class="tw"><table><tr><th>Name</th><th>Description</th></tr><tr><td>\u200b</td><td>\u200b</td></tr><tr><td>\u200b</td><td>\u200b</td></tr></table></div>';

export const EW_SL = [
  ['p', 'Text', '', 'Basic blocks', 'paragraph plain text', ''],
  ['h1', 'Heading 1', '', 'Basic blocks', 'title h1 #', '#'],
  ['h2', 'Heading 2', '', 'Basic blocks', 'subtitle h2 ##', '##'],
  ['h3', 'Heading 3', '', 'Basic blocks', 'h3 ###', '###'],
  ['ck', 'To-do list', '', 'Basic blocks', 'checkbox checklist task todo', '[]'],
  ['ul', 'Bulleted list', '', 'Basic blocks', 'bullet unordered list', '-'],
  ['ol', 'Numbered list', '', 'Basic blocks', 'ordered list', '1.'],
  ['tgl', 'Toggle list', '', 'Basic blocks', 'toggle collapse details accordion', '▸'],
  ['quote', 'Quote', '', 'Basic blocks', 'blockquote citation', '>'],
  ['hr', 'Divider', '', 'Basic blocks', 'separator line hr', '---'],
  ['note', 'Callout', '', 'Callouts', 'info note callout', ''],
  ['tip', 'Tip callout', '', 'Callouts', 'success green tip callout', ''],
  ['warn', 'Warning callout', '', 'Callouts', 'alert caution warning callout', ''],
  ['img', 'Image', '', 'Media', 'picture photo upload', ''],
  ['tbl', 'Table', '', 'Advanced', 'grid rows columns table', ''],
  ['code', 'Code', '', 'Advanced', 'snippet pre code', '```'],
  ['date', 'Today’s date', '', 'Advanced', 'time now date', ''],
];

export const TEXT_COLORS = [
  ['default', 'Default', 'inherit'],
  ['gray', 'Muted gray', '#8e8e93'],
  ['blue', 'Blue', '#4da3ff'],
  ['green', 'Green', '#34d369'],
  ['amber', 'Amber', '#ffaa2c'],
  ['red', 'Red', '#ff5449'],
  ['purple', 'Purple', '#c770ff'],
];

export const HL_COLORS = [
  ['none', 'No highlight', 'transparent'],
  ['yellow', 'Yellow', 'rgba(255,214,10,.38)'],
  ['blue', 'Blue', 'rgba(10,132,255,.32)'],
  ['green', 'Green', 'rgba(48,209,88,.32)'],
  ['amber', 'Amber', 'rgba(255,159,10,.34)'],
  ['pink', 'Pink', 'rgba(255,55,95,.32)'],
  ['purple', 'Purple', 'rgba(191,90,242,.32)'],
];

export const AI_ACTIONS = [
  ['improve', 'Improve writing', 'Refine technical clarity'],
  ['concise', 'Make concise', 'Shorten without losing meaning'],
  ['action', 'Convert to action step', 'Imperative standard phrasing'],
  ['code', 'Format as Revit / Tag', 'Wrap identifiers in inline code'],
];

export const EW_CL = { note: 'Note', tip: 'Tip', warn: 'Warning' };

export const BLOCK_LABELS = {
  p: 'Text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  ck: 'To-do',
  ul: 'Bulleted list',
  ol: 'Numbered list',
  tgl: 'Toggle',
  quote: 'Quote',
  note: 'Callout',
  tip: 'Tip',
  warn: 'Warning',
  code: 'Code',
};

export const TURN = [
  ['p', 'Text'],
  ['h1', 'Heading 1'],
  ['h2', 'Heading 2'],
  ['h3', 'Heading 3'],
  ['ck', 'To-do list'],
  ['ul', 'Bulleted list'],
  ['ol', 'Numbered list'],
  ['tgl', 'Toggle list'],
  ['quote', 'Quote'],
  ['note', 'Callout'],
  ['tip', 'Tip callout'],
  ['warn', 'Warning callout'],
  ['code', 'Code'],
];

export function BlockGlyph({ type, size = 15 }) {
  const S = (children, vb = '0 0 24 24') =>
    html`<svg width=${size} height=${size} viewBox=${vb} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">${children}</svg>`;

  if (type === 'p') return html`<span className="ewg-txt">Aa</span>`;
  if (type === 'h1') return html`<span className="ewg-txt">H1</span>`;
  if (type === 'h2') return html`<span className="ewg-txt">H2</span>`;
  if (type === 'h3') return html`<span className="ewg-txt">H3</span>`;

  switch (type) {
    case 'ck':
      return S(html`<rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><path d="M8 12.2l2.8 2.8L16.5 9" />`);
    case 'ul':
      return S(html`<line x1="9" y1="6.5" x2="20" y2="6.5" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="17.5" x2="20" y2="17.5" /><circle cx="4.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="17.5" r="1.1" fill="currentColor" stroke="none" />`);
    case 'ol':
      return S(html`<line x1="10" y1="6.5" x2="20" y2="6.5" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="17.5" x2="20" y2="17.5" /><path d="M4.5 5h1.5v4M4 9h3M4 13.5c0-.8.8-1.5 1.7-1.5.9 0 1.6.6 1.6 1.4 0 .7-.4 1.2-1.4 1.9L4 17h3.3" />`);
    case 'tgl':
      return S(html`<path d="M9 6.5l7 5.5-7 5.5V6.5z" fill="currentColor" stroke="none" />`);
    case 'quote':
      return S(html`<path d="M5 10h4.5v5.5a3 3 0 0 1-3 3H5M14.5 10H19v5.5a3 3 0 0 1-3 3h-1.5" /><line x1="5" y1="6.5" x2="5" y2="10" /><line x1="14.5" y1="6.5" x2="14.5" y2="10" />`);
    case 'hr':
      return S(html`<line x1="3.5" y1="12" x2="20.5" y2="12" strokeWidth="2.2" />`);
    case 'note':
      return S(html`<circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />`);
    case 'tip':
      return S(html`<circle cx="12" cy="12" r="9" /><path d="M8.5 12.2l2.4 2.4 4.8-5" />`);
    case 'warn':
      return S(html`<path d="M12 3.8L2.8 19.5h18.4L12 3.8z" /><line x1="12" y1="10" x2="12" y2="14" /><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none" />`);
    case 'img':
      return S(html`<rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="8.8" cy="9.5" r="1.4" /><path d="M4.5 17l4.6-4.5 3.6 3.5 2.7-2.6 4.1 3.6" />`);
    case 'tbl':
      return S(html`<rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><line x1="3.5" y1="9.5" x2="20.5" y2="9.5" /><line x1="3.5" y1="14.5" x2="20.5" y2="14.5" /><line x1="9.5" y1="4.5" x2="9.5" y2="19.5" />`);
    case 'code':
      return S(html`<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5.5l-3 13" />`);
    case 'date':
      return S(html`<rect x="3.5" y="5.5" width="17" height="15" rx="2.8" /><line x1="3.5" y1="10" x2="20.5" y2="10" /><line x1="8" y1="3.5" x2="8" y2="6.5" /><line x1="16" y1="3.5" x2="16" y2="6.5" />`);
    case 'dup':
      return S(html`<rect x="8.5" y="8.5" width="11" height="11" rx="2.2" /><path d="M5.5 15.5h-.8a1.7 1.7 0 0 1-1.7-1.7V5.2A1.7 1.7 0 0 1 4.7 3.5h8.6A1.7 1.7 0 0 1 15 5.2v.8" />`);
    case 'up':
      return S(html`<path d="M12 19V5M6.5 10.5L12 5l5.5 5.5" />`);
    case 'down':
      return S(html`<path d="M12 5v14M6.5 13.5L12 19l5.5-5.5" />`);
    case 'del':
      return S(html`<path d="M4.5 6.5h15M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M17.5 6.5l-.8 12a2 2 0 0 1-2 1.8H9.3a2 2 0 0 1-2-1.8l-.8-12" />`);
    case 'spark':
      return S(html`<path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" />`);
    case 'alL':
      return S(html`<line x1="4" y1="6.5" x2="20" y2="6.5" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="17.5" x2="18" y2="17.5" />`);
    case 'alC':
      return S(html`<line x1="4" y1="6.5" x2="20" y2="6.5" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="5" y1="17.5" x2="19" y2="17.5" />`);
    case 'alR':
      return S(html`<line x1="4" y1="6.5" x2="20" y2="6.5" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="6" y1="17.5" x2="20" y2="17.5" />`);
    case 'clearfmt':
      return S(html`<path d="M5 6h14M12 6l-4 12M4 18l16-12" />`);
    default:
      return html`<span className="ewg-txt">•</span>`;
  }
}
