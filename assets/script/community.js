import { supabase, user, esc } from './client.js';

const section = document.querySelector('[data-community]');
if (section) {
  const list = section.querySelector('[data-comments-list]');
  const form = section.querySelector('[data-comment-form]');
  const input = section.querySelector('[data-comment-input]');
  const status = section.querySelector('[data-comment-status]');
  const countNode = section.querySelector('[data-comments-count]');
  let currentUser = await user().catch(() => null);
  const gameId = new URLSearchParams(location.search).get('id');
  let rows = [];
  let likes = new Set();
  let likeCounts = new Map();
  let replyTarget = null;

  function message(text, error) {
    status.textContent = text || '';
    status.dataset.error = error ? 'true' : 'false';
  }
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function avatar(profile) {
    const img = make('img', 'h-9 w-9 rounded-full object-cover bg-slate-100');
    img.alt = (profile?.username || 'Player') + ' avatar';
    img.src = profile?.avatar_url || 'assets/icons/avatar.svg';
    img.onerror = () => { img.src = 'assets/icons/avatar.svg'; };
    return img;
  }
  function dateLabel(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }
  function actionButton(label, className, callback) {
    const button = make('button', className, label);
    button.type = 'button';
    button.addEventListener('click', callback);
    return button;
  }
  async function load() {
    message('Loading discussion…');
    const result = await supabase.from('comments')
      .select('id,user_id,body,parent_id,created_at,updated_at,profiles(username,avatar_url)')
      .eq('game_id', gameId).order('created_at', { ascending: false });
    if (result.error) {
      message('Could not load comments. ' + result.error.message, true);
      return;
    }
    rows = result.data || [];
    countNode.textContent = String(rows.length);
    const ids = rows.map(row => row.id);
    likes = new Set();
    likeCounts = new Map();
    if (ids.length) {
      const allLikes = await supabase.from('comment_likes').select('comment_id').in('comment_id', ids);
      if (!allLikes.error) {
        for (const like of allLikes.data || []) likeCounts.set(like.comment_id, (likeCounts.get(like.comment_id) || 0) + 1);
      }
      if (currentUser) {
        const ownLikes = await supabase.from('comment_likes').select('comment_id').eq('user_id', currentUser.id).in('comment_id', ids);
        if (!ownLikes.error) likes = new Set((ownLikes.data || []).map(row => row.comment_id));
      }
    }
    render();
    message('');
  }
  function renderComment(row, isReply) {
    const article = make('article', isReply ? 'ml-6 sm:ml-12 border-l-2 border-slate-200 pl-4 py-3' : 'rounded-2xl border border-slate-200 p-4');
    const header = make('div', 'flex items-center gap-3');
    header.append(avatar(row.profiles));
    const details = make('div', 'min-w-0 flex-1');
    details.append(make('p', 'font-semibold text-sm break-words', row.profiles?.username || 'Player'));
    details.append(make('p', 'text-xs text-slate-500', dateLabel(row.created_at) + (row.updated_at && row.updated_at !== row.created_at ? ' · edited' : '')));
    header.append(details);
    article.append(header);
    article.append(make('p', 'mt-3 whitespace-pre-wrap break-words text-sm', row.body));
    const actions = make('div', 'mt-3 flex flex-wrap items-center gap-3 text-xs');
    const likeText = (likes.has(row.id) ? '♥ Liked' : '♡ Like') + ' (' + (likeCounts.get(row.id) || 0) + ')';
    actions.append(actionButton(likeText, 'font-semibold text-slate-700 hover:underline', async buttonEvent => {
      if (!currentUser) { location.href = 'auth.html'; return; }
      const btn = buttonEvent.currentTarget;
      btn.disabled = true;
      const liked = likes.has(row.id);
      const result = liked
        ? await supabase.from('comment_likes').delete().eq('user_id', currentUser.id).eq('comment_id', row.id)
        : await supabase.from('comment_likes').insert({ user_id: currentUser.id, comment_id: row.id });
      if (result.error) message(result.error.message, true);
      else await load();
      btn.disabled = false;
    }));
    if (!isReply) {
      actions.append(actionButton('Reply', 'font-semibold text-slate-700 hover:underline', () => {
        if (!currentUser) { location.href = 'auth.html'; return; }
        replyTarget = row.id;
        input.placeholder = 'Reply to ' + (row.profiles?.username || 'player') + '…';
        form.querySelector('[data-submit-comment]').textContent = 'Post reply';
        form.querySelector('[data-cancel-reply]').hidden = false;
        input.focus();
      }));
    }
    if (currentUser && currentUser.id === row.user_id) {
      actions.append(actionButton('Edit', 'font-semibold text-slate-700 hover:underline', () => editComment(row)));
      actions.append(actionButton('Delete', 'font-semibold text-red-600 hover:underline', () => deleteComment(row)));
    }
    article.append(actions);
    return article;
  }
  function render() {
    list.replaceChildren();
    const topLevel = rows.filter(row => !row.parent_id);
    if (!topLevel.length) {
      list.append(make('p', 'rounded-xl bg-slate-50 p-4 text-sm text-slate-500', 'No comments yet. Start the discussion.'));
      return;
    }
    for (const row of topLevel) {
      const group = make('div', 'space-y-2');
      group.append(renderComment(row, false));
      const replies = rows.filter(reply => reply.parent_id === row.id).sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
      for (const reply of replies) group.append(renderComment(reply, true));
      list.append(group);
    }
  }
  async function editComment(row) {
    const replacement = prompt('Edit your comment:', row.body);
    if (replacement === null) return;
    const body = replacement.trim();
    if (!body || body.length > 1200) { message('Comment must be between 1 and 1200 characters.', true); return; }
    const result = await supabase.from('comments').update({ body, updated_at: new Date().toISOString() }).eq('id', row.id).eq('user_id', currentUser.id);
    if (result.error) message(result.error.message, true);
    else { message('Comment updated.'); await load(); }
  }
  async function deleteComment(row) {
    if (!confirm('Delete this comment' + (rows.some(reply => reply.parent_id === row.id) ? ' and its replies' : '') + '?')) return;
    const result = await supabase.from('comments').delete().eq('id', row.id).eq('user_id', currentUser.id);
    if (result.error) message(result.error.message, true);
    else { message('Comment deleted.'); await load(); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    currentUser = await user().catch(() => null);
    if (!currentUser) { location.href = 'auth.html'; return; }
    const body = input.value.trim();
    if (!body || body.length > 1200) { message('Comment must be between 1 and 1200 characters.', true); return; }
    const submit = form.querySelector('[data-submit-comment]');
    submit.disabled = true;
    message(replyTarget ? 'Posting reply…' : 'Posting comment…');
    const result = await supabase.from('comments').insert({
      game_id: gameId, user_id: currentUser.id, body, parent_id: replyTarget
    });
    submit.disabled = false;
    if (result.error) { message(result.error.message, true); return; }
    input.value = '';
    cancelReply();
    message('Posted.');
    await load();
  });
  function cancelReply() {
    replyTarget = null;
    input.placeholder = 'Share your thoughts about this game…';
    form.querySelector('[data-submit-comment]').textContent = 'Post comment';
    form.querySelector('[data-cancel-reply]').hidden = true;
  }
  form.querySelector('[data-cancel-reply]').addEventListener('click', cancelReply);
  supabase.auth.onAuthStateChange(() => { currentUser = null; user().then(u => { currentUser = u; }); });
  if (!gameId) {
    message('Open a game to view its discussion.', true);
    form.hidden = true;
  } else {
    load();
  }
}