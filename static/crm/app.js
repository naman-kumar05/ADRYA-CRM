/* ADYRA CRM — app.js */
window.ADYRA = (() => {
  'use strict';

  // ── Toast system ──────────────────────────────────────────────────────────

  function toast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = msg;
    container.appendChild(el);

    const delay = type === 'error' ? 7000 : 4000;
    setTimeout(() => {
      el.style.animation = 'toast-out .2s ease forwards';
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, delay);
  }

  function initToastsFromMessages() {
    const box = document.getElementById('django-messages');
    if (!box) return;
    box.querySelectorAll('span').forEach(el => {
      toast(el.textContent.trim(), el.classList.contains('error') ? 'error' : 'success');
    });
  }

  // ── Dropdown toggle ───────────────────────────────────────────────────────

  function toggleDropdown(btn, panel) {
    const open = panel.hasAttribute('hidden');
    // Close all open dropdowns first
    document.querySelectorAll('.avatar-dropdown, .notif-dropdown').forEach(d => {
      d.setAttribute('hidden', '');
    });
    document.querySelectorAll('[aria-expanded="true"]').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
    });
    if (open) {
      panel.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
    }
  }

  function initAvatar() {
    const btn = document.getElementById('avatarBtn');
    const panel = document.getElementById('avatarDropdown');
    if (!btn || !panel) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleDropdown(btn, panel);
    });
  }

  function initNotifs() {
    const btn = document.getElementById('notifBtn');
    const panel = document.getElementById('notifDropdown');
    if (!btn || !panel) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleDropdown(btn, panel);
    });
  }

  // Close any open dropdown on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.avatar-dropdown, .notif-dropdown').forEach(d => {
      d.setAttribute('hidden', '');
    });
    document.querySelectorAll('[aria-expanded="true"]').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
    });
  });

  // ── Command palette ───────────────────────────────────────────────────────

  const QUICK_LINKS = [
    { label: 'New Lead', sub: 'Create a new lead', url: '/leads/new/' },
    { label: 'Pipeline', sub: 'Open pipeline board', url: '/pipeline/' },
    { label: 'Follow-ups', sub: 'Today\'s follow-ups', url: '/follow-ups/' },
  ];

  function openCmdPalette() {
    const modal = document.getElementById('cmdModal');
    const input = document.getElementById('cmdInput');
    if (!modal) return;
    modal.removeAttribute('hidden');
    if (input) {
      input.value = '';
      input.focus();
    }
    renderCmdQuickLinks();
  }

  function closeCmdPalette() {
    const modal = document.getElementById('cmdModal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
    const results = document.getElementById('cmdResults');
    if (results) results.innerHTML = '';
  }

  function renderCmdQuickLinks() {
    const results = document.getElementById('cmdResults');
    if (!results) return;
    let html = '<div class="cmd-group-label">Quick Actions</div>';
    QUICK_LINKS.forEach(item => {
      html += `<a class="cmd-item" href="${item.url}">
        <svg width="16" height="16" aria-hidden="true"><use href="#icon-lightning"/></svg>
        <div><div class="cmd-item-label">${item.label}</div><div class="cmd-item-sub">${item.sub}</div></div>
      </a>`;
    });
    results.innerHTML = html;
  }

  function renderCmdResults(data) {
    const results = document.getElementById('cmdResults');
    if (!results) return;
    if (!data.results || !data.results.length) {
      results.innerHTML = '<p style="padding:20px 16px;text-align:center;color:var(--text-2);font-size:13px;">No results</p>';
      return;
    }
    const groups = {};
    data.results.forEach(r => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });
    const labels = { lead: 'Leads', customer: 'Customers', loan: 'Loans' };
    let html = '';
    Object.entries(groups).forEach(([type, items]) => {
      html += `<div class="cmd-group-label">${labels[type] || type}</div>`;
      items.forEach(item => {
        html += `<a class="cmd-item" href="${item.url}">
          <div><div class="cmd-item-label">${item.label}</div><div class="cmd-item-sub">${item.sub}</div></div>
        </a>`;
      });
    });
    results.innerHTML = html;
  }

  function moveCmdSelection(dir) {
    const results = document.getElementById('cmdResults');
    if (!results) return;
    const items = Array.from(results.querySelectorAll('.cmd-item'));
    if (!items.length) return;
    const current = results.querySelector('.cmd-item.active');
    let idx = current ? items.indexOf(current) + dir : (dir > 0 ? 0 : items.length - 1);
    idx = Math.max(0, Math.min(items.length - 1, idx));
    items.forEach(el => el.classList.remove('active'));
    items[idx].classList.add('active');
    items[idx].scrollIntoView({ block: 'nearest' });
  }

  let _cmdDebounce = null;

  function initCmdPalette() {
    const trigger = document.getElementById('cmdTrigger');
    const backdrop = document.getElementById('cmdBackdrop');
    const input = document.getElementById('cmdInput');

    if (trigger) trigger.addEventListener('click', openCmdPalette);
    if (backdrop) backdrop.addEventListener('click', closeCmdPalette);

    if (input) {
      input.addEventListener('input', () => {
        clearTimeout(_cmdDebounce);
        const q = input.value.trim();
        if (q.length < 2) { renderCmdQuickLinks(); return; }
        _cmdDebounce = setTimeout(() => {
          fetch(`/api/search/?q=${encodeURIComponent(q)}`)
            .then(r => r.json())
            .then(renderCmdResults)
            .catch(() => {});
        }, 200);
      });

      input.addEventListener('keydown', e => {
        const results = document.getElementById('cmdResults');
        if (e.key === 'ArrowDown') { e.preventDefault(); moveCmdSelection(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveCmdSelection(-1); }
        else if (e.key === 'Enter') {
          const active = results && results.querySelector('.cmd-item.active');
          if (active && active.href) { closeCmdPalette(); window.location.href = active.href; }
        }
      });
    }

    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        openCmdPalette();
        return;
      }
      if (e.key === 'Escape') {
        closeCmdPalette();
      }
    });
  }

  // ── Form double-submit prevention ─────────────────────────────────────────

  function initForms() {
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', () => {
        const btn = form.querySelector('[type="submit"]');
        if (btn) {
          btn.disabled = true;
          btn.classList.add('loading');
        }
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    initToastsFromMessages();
    initAvatar();
    initNotifs();
    initCmdPalette();
    initForms();
  });

  return { toast, openCmdPalette, closeCmdPalette, toggleDropdown };
})();
