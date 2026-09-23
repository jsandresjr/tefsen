import {
  POST_ACCEPTANCE_DECISION_LABELS,
  POST_ACCEPTANCE_CATEGORY_LABELS
} from './services/post-acceptance-service.js';

function esc(value='') {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function taskMarkup(task={}, nextId='', opportunityId='') {
  const classes = [
    'post-acceptance-task',
    task.completed ? 'done' : '',
    task.id === nextId ? 'next' : ''
  ].filter(Boolean).join(' ');
  const category = POST_ACCEPTANCE_CATEGORY_LABELS[task.category] || 'Next step';
  const source = task.source === 'system'
    ? 'Suggested by Tefsen — verify if it applies'
    : 'Your private task';

  return '<div class="' + classes + '">' +
    '<button class="post-acceptance-check" type="button" data-post-acceptance-task-toggle="' + esc(task.id) +
      '" data-opportunity-id="' + esc(opportunityId) + '" aria-label="' +
      (task.completed ? 'Mark incomplete' : 'Mark complete') + '">' + (task.completed ? '✓' : '') + '</button>' +
    '<div><b>' + esc(task.label) + '</b><small>' + esc(category) + ' · ' + esc(source) + '</small></div>' +
    (task.source === 'custom'
      ? '<button class="journey-task-remove" type="button" data-post-acceptance-task-delete="' + esc(task.id) +
        '" data-opportunity-id="' + esc(opportunityId) + '">Remove</button>'
      : '') +
  '</div>';
}

export function postAcceptancePanelMarkup(model=null, opportunityId='') {
  if (!model?.active) return '';

  const plan = model.plan || {};
  const next = model.tasks?.next || null;
  const decisionOptions = Object.entries(POST_ACCEPTANCE_DECISION_LABELS)
    .map(([value,label]) => '<option value="' + esc(value) + '"' +
      (plan.offerDecision === value ? ' selected' : '') + '>' + esc(label) + '</option>')
    .join('');

  const categoryOptions = Object.entries(POST_ACCEPTANCE_CATEGORY_LABELS)
    .map(([value,label]) => '<option value="' + esc(value) + '">' + esc(label) + '</option>')
    .join('');

  const incomplete = Array.isArray(model.tasks?.incomplete) ? model.tasks.incomplete : [];
  const completed = Array.isArray(model.tasks?.completed) ? model.tasks.completed : [];

  return '<section class="journey-detail-card post-acceptance-card">' +
    '<header class="journey-detail-card-head checklist">' +
      '<div><span>POST-ACCEPTANCE PLAN</span><h2>' + esc(model.attention?.title || 'Organize the next official steps.') + '</h2>' +
      '<p>Keep next steps separate from the completed application record. Verify every requirement with the provider or relevant authority.</p></div>' +
      '<strong>' + Number(model.progress?.percent || 0) + '%</strong>' +
    '</header>' +

    '<div class="post-acceptance-attention ' + esc(model.attention?.tone || 'active') + '">' +
      '<span>' + esc(model.attention?.label || 'Accepted') + '</span>' +
      '<p>' + esc(model.attention?.detail || '') + '</p>' +
    '</div>' +

    '<form class="post-acceptance-plan-form" data-post-acceptance-plan-form="' + esc(opportunityId) + '">' +
      '<div class="post-acceptance-fields">' +
        '<div class="field"><label>Private offer decision</label>' +
          '<select class="select" name="offerDecision">' + decisionOptions + '</select>' +
          '<small>This is your private planning state, not a provider status.</small>' +
          '<span class="field-error" data-post-acceptance-error="offerDecision" hidden></span></div>' +
        '<div class="field"><label>Offer response date <small>Optional</small></label>' +
          '<input class="input" type="date" name="offerResponseDate" value="' + esc(plan.offerResponseDate || '') + '">' +
          '<small>Add only a date stated by the provider. Confirm the exact time and time zone officially.</small>' +
          '<span class="field-error" data-post-acceptance-error="offerResponseDate" hidden></span></div>' +
        '<div class="field"><label>Enrollment / registration date <small>Optional</small></label>' +
          '<input class="input" type="date" name="enrollmentDate" value="' + esc(plan.enrollmentDate || '') + '">' +
          '<small>Use only if the provider gives a real date you need to track.</small>' +
          '<span class="field-error" data-post-acceptance-error="enrollmentDate" hidden></span></div>' +
      '</div>' +
      '<div class="journey-planning-summary" data-post-acceptance-summary hidden></div>' +
      '<button class="btn btn-primary" type="submit">Save next-stage plan</button>' +
    '</form>' +

    '<div class="post-acceptance-progress"><div><span>NEXT-STAGE TASKS</span><b>' +
      Number(model.progress?.completed || 0) + '/' + Number(model.progress?.total || 0) + ' complete</b></div>' +
      '<div class="journey-progress-bar"><i style="width:' + Number(model.progress?.percent || 0) + '%"></i></div></div>' +

    (next
      ? '<section class="journey-next-task post"><span>NEXT POST-ACCEPTANCE TASK</span><h3>' + esc(next.label) +
        '</h3><p>Confirm this step applies to your offer before acting.</p></section>'
      : '') +

    '<div class="post-acceptance-task-list">' +
      (incomplete.length
        ? incomplete.map(task => taskMarkup(task,next?.id || '',opportunityId)).join('')
        : '<div class="journey-checklist-empty"><span class="post-acceptance-done-mark">✓</span><div><b>No open post-acceptance tasks.</b>' +
          '<p>Re-check the provider portal and any official government requirements that apply to you before considering this stage complete.</p></div></div>') +
    '</div>' +

    '<form class="post-acceptance-add-task" data-post-acceptance-task-form="' + esc(opportunityId) + '">' +
      '<input class="input" name="label" maxlength="240" required placeholder="Add a private next-stage task">' +
      '<select class="select" name="category">' + categoryOptions + '</select>' +
      '<button class="btn btn-secondary" type="submit">Add task</button>' +
    '</form>' +

    (completed.length
      ? '<details class="journey-completed-tasks post-acceptance-completed"><summary><span>Completed next-stage tasks</span><b>' +
        completed.length + '</b></summary><div>' +
        completed.map(task => taskMarkup(task,next?.id || '',opportunityId)).join('') +
        '</div></details>'
      : '') +

    '<div class="post-acceptance-safety"><span>i</span><p><b>Planning tool only.</b> Tefsen does not issue admission instructions, determine visa eligibility, or provide immigration/legal advice. Provider and government sources remain authoritative.</p></div>' +
  '</section>';
}
