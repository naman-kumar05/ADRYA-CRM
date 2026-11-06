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

  function openCmdPalette() {
    const modal = document.getElementById('cmdModal');
    const input = document.getElementById('cmdInput');
    if (!modal) return;
    modal.removeAttribute('hidden');
    if (input) { input.value = ''; input.focus(); }
  }

  function closeCmdPalette() {
    const modal = document.getElementById('cmdModal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
    const results = document.getElementById('cmdResults');
    if (results) results.innerHTML = '';
  }

  function initCmdPalette() {
    const trigger = document.getElementById('cmdTrigger');
    const backdrop = document.getElementById('cmdBackdrop');
    const input = document.getElementById('cmdInput');

    if (trigger) trigger.addEventListener('click', openCmdPalette);
    if (backdrop) backdrop.addEventListener('click', closeCmdPalette);

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

    // Populated in Task 4 — input handler registered there
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
