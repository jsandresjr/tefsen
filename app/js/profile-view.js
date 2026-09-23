function esc(value='') {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function count(value=0) {
  const n=Math.max(0,Number(value || 0));
  if(n>=1000000) return (n/1000000).toFixed(n>=10000000?0:1).replace('.0','')+'M';
  if(n>=1000) return (n/1000).toFixed(n>=10000?0:1).replace('.0','')+'K';
  return String(n);
}

function improvementMarkup(items=[], own=false) {
  if(!own) return '';
  if(!items.length) {
    return '<div class="profile-final-complete-note"><span>✓</span><div><b>Public profile ready</b><p>Your main public profile fields are complete. You can edit them any time.</p></div></div>';
  }
  return '<div class="profile-final-improve-list">' +
    items.slice(0,3).map(item =>
      '<button type="button" data-edit-profile data-profile-focus="' + esc(item.key) + '">' +
        '<span>+</span><div><b>' + esc(item.label) + '</b><small>' + esc(item.detail) + '</small></div>' +
      '</button>'
    ).join('') +
  '</div>';
}

export function profileFinalPageMarkup({
  model,
  avatarHtml='',
  roleHtml='',
  verifiedHtml='',
  actionsHtml='',
  activityHtml='',
  activityActionHtml='',
  photoActionsHtml=''
}={}) {
  const view=model?.public || {};
  const privateView=model?.private || null;
  const own=Boolean(model?.own);
  const completion=view.completion || {percent:0,improve:[]};
  const photoClass=view.hasPhoto ? 'has-photo' : 'no-photo';
  const handleClass=view.username ? '' : 'placeholder';
  const bioClass=view.bio ? '' : 'placeholder';

  const photoSurface = own
    ? '<div class="profile-final-photo-control ' + photoClass + '">' +
        '<button class="profile-final-photo-button" type="button" data-profile-photo-edit aria-label="' + (view.hasPhoto ? 'Change profile photo' : 'Add profile photo') + '">' +
          '<span class="profile-final-photo-media">' + avatarHtml + '</span>' +
          '<span class="profile-final-photo-edit" aria-hidden="true">✎</span>' +
        '</button>' +
        photoActionsHtml +
      '</div>'
    : '<div class="profile-final-photo-control ' + photoClass + '"><span class="profile-final-photo-media static">' + avatarHtml + '</span></div>';

  const publicHero =
    '<section class="profile-final-hero">' +
      '<div class="profile-final-hero-top">' +
        '<span class="profile-final-eyebrow">PUBLIC PROFILE</span>' +
        (own ? '<span class="profile-final-visibility">Visible to the Tefsen community</span>' : '') +
      '</div>' +
      '<div class="profile-final-identity">' +
        photoSurface +
        '<div class="profile-final-copy">' +
          '<div class="profile-final-name-line">' +
            '<div><h1>' + esc(view.fullName || 'Tefsen User') + ' ' + verifiedHtml + '</h1>' +
            '<button class="profile-final-handle ' + handleClass + '" type="button"' + (own ? ' data-edit-profile data-profile-focus="username"' : ' disabled') + '>' + esc(view.displayHandle || '') + '</button></div>' +
            roleHtml +
          '</div>' +
          '<button class="profile-final-bio ' + bioClass + '" type="button"' + (own ? ' data-edit-profile data-profile-focus="bio"' : ' disabled') + '>' + esc(view.displayBio || '') + '</button>' +
          actionsHtml +
        '</div>' +
      '</div>' +
      '<div class="profile-final-public-stats" aria-label="Public profile statistics">' +
        '<div><strong>' + count(view.stats?.posts) + '</strong><span>Public posts</span></div>' +
        '<div><strong>' + count(view.stats?.followers) + '</strong><span>Followers</span></div>' +
        '<div><strong>' + count(view.stats?.following) + '</strong><span>Following</span></div>' +
      '</div>' +
    '</section>';

  const completionPanel = own
    ? '<section class="profile-final-completion">' +
        '<div class="profile-final-completion-head">' +
          '<div><span>PUBLIC PROFILE QUALITY</span><h2>' + Number(completion.percent || 0) + '% complete</h2><p>This measures public profile setup only. It is not Student Passport completeness, eligibility, or admission probability.</p></div>' +
          '<button class="btn btn-secondary" type="button" data-edit-profile>Edit public profile</button>' +
        '</div>' +
        '<div class="profile-final-meter"><i style="width:' + Number(completion.percent || 0) + '%"></i></div>' +
        improvementMarkup(completion.improve || [], true) +
      '</section>'
    : '';

  const privateWorkspace = privateView
    ? '<section class="profile-private-workspace">' +
        '<header class="profile-private-head"><div><span>PRIVATE STUDENT WORKSPACE</span><h2>Your application path stays separate from your public identity.</h2><p>Student Passport, saved opportunities and application Journeys are private account tools unless you explicitly publish selected community content.</p></div><span class="profile-private-lock">PRIVATE TO YOU</span></header>' +
        '<div class="profile-private-goal"><span>YOUR STUDY DIRECTION</span><h3>' + esc(privateView.goal) + '</h3></div>' +
        '<div class="profile-private-metrics">' +
          '<button type="button" data-route="passport"><span>Student Passport</span><strong>' + Number(privateView.passportCompleteness || 0) + '%</strong><small>Private matching profile</small></button>' +
          '<button type="button" data-route="journeys"><span>Active Journeys</span><strong>' + count(privateView.activeJourneys) + '</strong><small>Private application tracking</small></button>' +
          '<button type="button" data-route="opportunities"><span>Saved opportunities</span><strong>' + count(privateView.savedOpportunities) + '</strong><small>Private decision workspace</small></button>' +
        '</div>' +
        '<div class="profile-private-actions"><button class="btn btn-primary" type="button" data-route="passport">Open Student Passport</button><button class="btn btn-secondary" type="button" data-route="journeys">Open Journey</button><button class="btn btn-ghost" type="button" data-route="opportunities">Find opportunities</button></div>' +
      '</section>'
    : '';

  const activity =
    '<section class="profile-final-activity">' +
      '<header class="profile-final-section-head">' +
        '<div><span>COMMUNITY</span><h2>' + (own ? 'Your public activity' : 'Public activity') + '</h2><p>' + (own ? 'Only discussions, success stories and journey details you explicitly publish appear here.' : 'Public discussions and outcomes this student chose to share.') + '</p></div>' +
        activityActionHtml +
      '</header>' +
      '<div class="feed-list">' + activityHtml + '</div>' +
    '</section>';

  return '<div class="profile-final-page">' + publicHero + completionPanel + privateWorkspace + activity + '</div>';
}
