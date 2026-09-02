// Tefsen 7-day Google Play trial messaging for the Web subscription page.
// The Web app does not process Google Play Billing directly. Eligible users
// start the trial through the Android app, then the subscription syncs back
// to the same Tefsen account used on Web.

const TRIAL_DAYS = 7;
const NORMAL_PRICE = '$2.99';
const GOOGLE_PLAY_APP_URL = 'https://play.google.com/store/apps/details?id=com.tefsen.app';

function isSubscriptionRoute() {
  return location.hash.replace(/^#\/?/, '').split('/')[0].toLowerCase() === 'subscription';
}

function patchTrialUI() {
  if (!isSubscriptionRoute()) return;

  const page = document.querySelector('.subscription-luxury-page');
  if (!page || page.dataset.trialPatched === '1') return;

  const hero = page.querySelector('.lux-plan-hero');
  const isCurrentPlus = hero?.classList.contains('is-plus');
  const isAdmin = hero?.classList.contains('is-admin');
  if (isCurrentPlus || isAdmin) {
    page.dataset.trialPatched = '1';
    return;
  }

  page.dataset.trialPatched = '1';

  const overline = page.querySelector('.subscription-luxury-head .lux-overline');
  if (overline) overline.textContent = `${TRIAL_DAYS}-DAY FREE TRIAL`;

  const headTitle = page.querySelector('.subscription-luxury-head h1');
  if (headTitle) headTitle.textContent = 'Try Student Plus free for 7 days.';

  const headCopy = page.querySelector('.subscription-luxury-head p');
  if (headCopy) headCopy.textContent = `Eligible new subscribers can try Tefsen Student Plus free for ${TRIAL_DAYS} days, then continue at ${NORMAL_PRICE}/month unless cancelled.`;

  const heroPrice = page.querySelector('.lux-plan-price .lux-price');
  if (heroPrice) {
    heroPrice.innerHTML = `<strong>${TRIAL_DAYS} days free</strong><span>then ${NORMAL_PRICE} / month</span>`;
  }

  const heroPriceNote = page.querySelector('.lux-plan-price > small');
  if (heroPriceNote) heroPriceNote.textContent = 'Google Play billing · eligible new subscribers';

  const heroPrimary = page.querySelector('.lux-plan-actions .lux-primary');
  if (heroPrimary) {
    heroPrimary.textContent = `Start ${TRIAL_DAYS}-day free trial`;
    heroPrimary.setAttribute('href', GOOGLE_PLAY_APP_URL);
    heroPrimary.setAttribute('target', '_blank');
    heroPrimary.setAttribute('rel', 'noopener noreferrer');
  }

  const plusCard = page.querySelector('.lux-plan-card-plus');
  if (plusCard) {
    const kicker = plusCard.querySelector('.lux-card-kicker');
    if (kicker) kicker.textContent = `${TRIAL_DAYS}-DAY FREE TRIAL`;

    const priceTitle = plusCard.querySelector('h3');
    if (priceTitle) priceTitle.innerHTML = `Free for ${TRIAL_DAYS} days <small>then ${NORMAL_PRICE} / month</small>`;

    const description = plusCard.querySelector('p');
    if (description) description.textContent = 'Try Student Plus before paying. Available to eligible new subscribers.';

    const cta = plusCard.querySelector('.lux-card-cta');
    if (cta) {
      cta.textContent = `Start free trial in Android app →`;
      cta.setAttribute('href', GOOGLE_PLAY_APP_URL);
    }
  }

  const billingCard = page.querySelector('.lux-billing-card');
  if (billingCard) {
    const title = billingCard.querySelector('h3');
    if (title) title.textContent = 'Start the free trial with Google Play.';

    const copy = billingCard.querySelector('p');
    if (copy) copy.textContent = `Open the Tefsen Android app with the same account. If Google Play says you are eligible, start the ${TRIAL_DAYS}-day free trial there and then sync your subscription on Web.`;

    const action = billingCard.querySelector('.lux-primary');
    if (action) action.textContent = 'Open Tefsen on Google Play';
  }
}

let trialPatchQueued = false;
const trialObserver = new MutationObserver(() => {
  if (trialPatchQueued) return;
  trialPatchQueued = true;
  requestAnimationFrame(() => {
    trialPatchQueued = false;
    patchTrialUI();
  });
});

trialObserver.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', patchTrialUI);
document.addEventListener('DOMContentLoaded', patchTrialUI, { once: true });
patchTrialUI();
