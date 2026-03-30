// State management for Outreach V2
// Persisted to localStorage key: 'outreach-v2'

const STORAGE_KEY = 'outreach-v2';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      position: state._position,
      sent: [...state._sent],
      skipped: [...state._skipped],
      edits: state._edits,
    }));
  } catch { /* ignore quota errors */ }
}

function normalizeFirm(f, index) {
  const id = (f.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '') || `firm-${index}`;
  return {
    id,
    rank: f.rank ?? index + 1,
    firm: f.name || f.firm || '',
    tier: f.tier || '',
    hq: f.hq || '',
    fundSize: f.fundSize || '',
    stage: f.stage || '',
    thesis: f.thesis || '',
    portfolio: f.portfolio || [],
    contact: f.contactName || f.contact || '',
    contactTitle: f.contactFull || '',
    contactContext: f.contactContext || '',
    email: f.email || '',
    why: f.why || '',
    emailSubject: f.emailSubject || '',
    emailBody: f.emailBody || '',
    firstName: f.firstName || '',
  };
}

window.OutreachState = {
  _firms: [],
  _position: 0,
  _sent: new Set(),
  _skipped: new Set(),
  _edits: {},

  init(firms) {
    this._firms = firms.map(normalizeFirm);
    const saved = loadPersistedState();
    if (saved) {
      this._position = saved.position || 0;
      this._sent = new Set(saved.sent || []);
      this._skipped = new Set(saved.skipped || []);
      this._edits = saved.edits || {};
    }
    // Clamp position
    if (this._position < 0 || this._position >= this._firms.length) {
      this._position = 0;
    }
  },

  getCurrentFirm() {
    return this._firms[this._position] || null;
  },

  getPosition() {
    return this._position;
  },

  setPosition(i) {
    if (i >= 0 && i < this._firms.length) {
      this._position = i;
      persist(this);
    }
  },

  next() {
    if (this._position < this._firms.length - 1) {
      this._position++;
      persist(this);
    }
  },

  prev() {
    if (this._position > 0) {
      this._position--;
      persist(this);
    }
  },

  markSent(id) {
    this._sent.add(id);
    this._skipped.delete(id);
    persist(this);
  },

  markSkipped(id) {
    this._skipped.add(id);
    this._sent.delete(id);
    persist(this);
  },

  unmark(id) {
    this._sent.delete(id);
    this._skipped.delete(id);
    persist(this);
  },

  getStatus(id) {
    if (this._sent.has(id)) return 'sent';
    if (this._skipped.has(id)) return 'skipped';
    return 'queue';
  },

  saveEdit(id, field, value) {
    if (!this._edits[id]) this._edits[id] = {};
    this._edits[id][field] = value;
    persist(this);
  },

  getEdit(id, field) {
    return this._edits[id]?.[field] ?? null;
  },

  getEffectiveEmail(id) {
    const edit = this.getEdit(id, 'emailBody');
    if (edit !== null) return edit;
    const firm = this._firms.find(f => f.id === id);
    return firm?.emailBody || '';
  },

  getEffectiveSubject(id) {
    const edit = this.getEdit(id, 'emailSubject');
    if (edit !== null) return edit;
    const firm = this._firms.find(f => f.id === id);
    return firm?.emailSubject || '';
  },

  getCounts() {
    return {
      queue: this._firms.length - this._sent.size - this._skipped.size,
      sent: this._sent.size,
      skipped: this._skipped.size,
      total: this._firms.length,
    };
  },

  exportState() {
    return {
      firms: this._firms,
      position: this._position,
      sent: [...this._sent],
      skipped: [...this._skipped],
      edits: this._edits,
      counts: this.getCounts(),
    };
  },

  // Helper: get firms filtered by status
  getFirmsByStatus(status) {
    return this._firms.filter(f => this.getStatus(f.id) === status);
  },

  // Extended API for UI integration
  getAllFirms() {
    return this._firms;
  },

  getFirmById(id) {
    return this._firms.find(f => f.id === id) || null;
  },

  getFirmByIndex(i) {
    return this._firms[i] || null;
  },

  getQueueFirms() {
    return this.getFirmsByStatus('queue');
  },

  getSentFirms() {
    return this.getFirmsByStatus('sent');
  },

  getSkippedFirms() {
    return this.getFirmsByStatus('skipped');
  },

  resetEdits(id) {
    delete this._edits[id];
    persist(this);
  },

  clearAll() {
    this._position = 0;
    this._sent = new Set();
    this._skipped = new Set();
    this._edits = {};
    persist(this);
  },
};

// Keyboard Navigation
document.addEventListener('keydown', function (e) {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
    return;
  }

  const S = window.OutreachState;

  switch (e.key) {
    case 'j':
    case 'ArrowDown':
      e.preventDefault();
      S.next();
      window.dispatchEvent(new CustomEvent('outreach:navigate', { detail: { direction: 'next' } }));
      break;

    case 'k':
    case 'ArrowUp':
      e.preventDefault();
      S.prev();
      window.dispatchEvent(new CustomEvent('outreach:navigate', { detail: { direction: 'prev' } }));
      break;

    case 's': {
      const firm = S.getCurrentFirm();
      if (firm) {
        S.markSent(firm.id);
        window.dispatchEvent(new CustomEvent('outreach:statusChange', { detail: { id: firm.id, status: 'sent' } }));
      }
      break;
    }

    case 'x': {
      const firm = S.getCurrentFirm();
      if (firm) {
        S.markSkipped(firm.id);
        window.dispatchEvent(new CustomEvent('outreach:statusChange', { detail: { id: firm.id, status: 'skipped' } }));
      }
      break;
    }

    case 'u': {
      const firm = S.getCurrentFirm();
      if (firm) {
        S.unmark(firm.id);
        window.dispatchEvent(new CustomEvent('outreach:statusChange', { detail: { id: firm.id, status: 'queue' } }));
      }
      break;
    }

    case 'c': {
      const firm = S.getCurrentFirm();
      if (firm) {
        const body = S.getEffectiveEmail(firm.id);
        navigator.clipboard.writeText(body).then(() => {
          window.dispatchEvent(new CustomEvent('outreach:copied', { detail: { field: 'emailBody' } }));
        });
      }
      break;
    }

    case 'Enter':
    case ' ':
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('outreach:toggle', { detail: { position: S.getPosition() } }));
      break;
  }
});
