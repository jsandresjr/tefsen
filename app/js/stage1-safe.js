// Stage 1: low-risk UX improvements that do not change Firebase data.
const stage1ModalRoot = document.getElementById('modal-root');

function postShareUrl(postId) {
  return `${location.origin}${location.pathname}#/post/${encodeURIComponent(String(postId || ''))}`;
}

async function copyShareLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const input = document.createElement('textarea');
      input.value = url;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      input.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function closeShareSheet() {
  if (stage1ModalRoot?.querySelector('[data-stage1-share-sheet]')) stage1ModalRoot.innerHTML = '';
}

function showShareFeedback(message) {
  const toastRoot = document.getElementById('toast-root');
  if (!toastRoot) return;
  const node = document.createElement('div');
  node.className = 'toast success stage1-toast';
  node.textContent = message;
  toastRoot.appendChild(node);
  setTimeout(() => node.remove(), 2400);
}

function openExternal(url) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  return Boolean(opened);
}

function openShareSheet(postId) {
  if (!stage1ModalRoot || !postId) return;
  const url = postShareUrl(postId);
  stage1ModalRoot.innerHTML = `
    <div class="modal-backdrop stage1-share-backdrop" data-stage1-share-close>
      <section class="modal stage1-share-sheet" data-stage1-share-sheet role="dialog" aria-modal="true" aria-labelledby="stage1-share-title">
        <header class="modal-head">
          <div>
            <h2 id="stage1-share-title">Share question</h2>
            <p>Choose how you want to share this Tefsen question.</p>
          </div>
          <button class="close-btn" type="button" data-stage1-share-close aria-label="Close share options">×</button>
        </header>
        <div class="modal-body stage1-share-grid">
          <button type="button" data-stage1-share="whatsapp"><span>WhatsApp</span><small>Send to a chat or group</small></button>
          <button type="button" data-stage1-share="telegram"><span>Telegram</span><small>Share to Telegram</small></button>
          <button type="button" data-stage1-share="messenger"><span>Messenger</span><small>Open Messenger if available</small></button>
          <button type="button" data-stage1-share="email"><span>Email</span><small>Send with your mail app</small></button>
          <button type="button" data-stage1-share="copy"><span>Copy link</span><small>Copy the direct question link</small></button>
          <button type="button" data-stage1-share="more"><span>More options</span><small>Use your device share menu</small></button>
        </div>
      </section>
    </div>`;
  const sheet = stage1ModalRoot.querySelector('[data-stage1-share-sheet]');
  if (sheet) sheet.dataset.shareUrl = url;
}

async function handleShareChoice(button) {
  const sheet = button.closest('[data-stage1-share-sheet]');
  const url = sheet?.dataset.shareUrl || '';
  if (!url) return;
  const encodedUrl = encodeURIComponent(url);
  const text = encodeURIComponent('Tefsen academic question');
  const choice = button.dataset.stage1Share;

  if (choice === 'whatsapp') {
    openExternal(`https://wa.me/?text=${text}%20${encodedUrl}`);
    closeShareSheet();
    return;
  }
  if (choice === 'telegram') {
    openExternal(`https://t.me/share/url?url=${encodedUrl}&text=${text}`);
    closeShareSheet();
    return;
  }
  if (choice === 'messenger') {
    location.href = `fb-messenger://share/?link=${encodedUrl}`;
    setTimeout(async () => {
      if (document.visibilityState === 'visible') {
        if (navigator.share) {
          try { await navigator.share({ title: 'Tefsen question', url }); } catch {}
        } else if (await copyShareLink(url)) {
          showShareFeedback('Messenger unavailable — link copied instead.');
        }
      }
    }, 800);
    closeShareSheet();
    return;
  }
  if (choice === 'email') {
    location.href = `mailto:?subject=${encodeURIComponent('Tefsen academic question')}&body=${encodeURIComponent(`I thought you might find this useful:\n\n${url}`)}`;
    closeShareSheet();
    return;
  }
  if (choice === 'copy') {
    if (await copyShareLink(url)) showShareFeedback('Question link copied.');
    else showShareFeedback('Could not copy automatically.');
    closeShareSheet();
    return;
  }
  if (choice === 'more') {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tefsen academic question', text: 'Tefsen academic question', url });
      } catch {}
    } else if (await copyShareLink(url)) {
      showShareFeedback('Share menu unavailable — link copied instead.');
    }
    closeShareSheet();
  }
}

function hideKnownDisabledPrimaryControls() {
  document.querySelectorAll('.sidebar [data-route="messages"], .sidebar [data-route="saved"]').forEach(el => {
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
  });
}

document.addEventListener('click', async event => {
  const share = event.target.closest?.('[data-share]');
  if (share) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openShareSheet(share.dataset.share);
    return;
  }

  const choice = event.target.closest?.('[data-stage1-share]');
  if (choice) {
    event.preventDefault();
    await handleShareChoice(choice);
    return;
  }

  const close = event.target.closest?.('[data-stage1-share-close]');
  if (close && (close === event.target || close.matches('button'))) {
    event.preventDefault();
    closeShareSheet();
  }
}, true);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeShareSheet();
});

const stage1Observer = new MutationObserver(() => hideKnownDisabledPrimaryControls());
stage1Observer.observe(document.getElementById('app-root'), { childList: true, subtree: true });
hideKnownDisabledPrimaryControls();
