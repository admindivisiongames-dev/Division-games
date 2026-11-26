import { supabase, user, esc } from './client.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const say = (node, message) => { if (node) node.textContent = message; };
const currentUser = await user().catch(()=>null);
const profileResult = currentUser ? await supabase.from('profiles').select('username,role,avatar_url,created_at,first_name,last_name,bio,suspended').eq('id',currentUser.id).maybeSingle() : {data:null};
const profile = profileResult.data || {};
const ADMIN_EMAIL = 'admin.division.games@gmail.com';
const isAdmin = profile.role === 'admin' && currentUser?.email?.toLowerCase() === ADMIN_EMAIL;

async function getGames(showUnpublished=false) {
  let q = supabase.from('games').select('*').order('created_at',{ascending:false});
  if (!showUnpublished) q = q.eq('published',true);
  const {data,error}=await q;
  if(error) throw error;
  return data || [];
}
function gameHref(g){return 'game.html?id='+encodeURIComponent(g.id)}
function titleNode(card){return card.querySelector('h3,h4,[data-game-title],.font-display')}
function gameCard(g){
  const a=document.createElement('a');
  a.href=gameHref(g);
  a.className='group block rounded-2xl overflow-hidden bg-light-surface-container-lowest border border-light-outline-variant/40 hover:shadow-lg transition';
  a.innerHTML='<div class="relative aspect-[16/10] overflow-hidden bg-section-turquoise/40 flex items-center justify-center"><span class="font-display text-5xl text-navy-ink"></span></div><div class="p-4"><h3 class="font-display text-title-lg text-navy-ink"></h3><p class="font-body text-body-sm text-light-outline mt-1"></p></div>';
  const cover=$('div',a);
  if(g.image_url){
    const img=document.createElement('img');img.src=g.image_url;img.alt=g.title+' game artwork';img.loading='lazy';img.referrerPolicy='no-referrer';img.className='absolute inset-0 w-full h-full object-cover';img.onerror=()=>img.remove();cover.append(img);
  }else{$('span',cover).textContent=g.symbol||'✦'}
  $('h3',a).textContent=g.title;
  $('p',a).textContent=g.category||'Browser game';
  return a;
}
function injectNotice(text){
  const n=document.createElement('div');
  n.className='mx-auto my-4 max-w-6xl px-5 py-3 rounded-xl bg-section-yellow/40 text-navy-ink font-body text-sm';
  n.textContent=text;
  document.body.prepend(n);
  return n;
}
function wireNavigation(){
  const navLinks=$('a[href="auth.html"],a[href="profile.html"],a[href="index.html"]');
  if(currentUser){
    navLinks.filter(a=>/sign in|log in|create account/i.test(a.textContent)).forEach(a=>{a.href='profile.html';a.textContent=profile.username||'My Profile'});
    $$('a[href="profile.html"]').forEach(a=>{
      const label=a.querySelector('span');
      if(label)label.textContent=profile.username||'My Profile';
      else if(!a.querySelector('img'))a.textContent=profile.username||'My Profile';
      const img=a.querySelector('img');if(img&&profile.avatar_url)img.src=profile.avatar_url;
    });
  }
}
wireNavigation();

function applyProfileAvatar(url){
  if(!url)return;
  document.querySelectorAll('a[href="profile.html"] img').forEach(img=>{img.src=url;img.alt='Profile avatar'});
}
applyProfileAvatar(profile.avatar_url);

async function homePage(){
  let games=[];
  try{games=await getGames()}catch(e){injectNotice('Could not load games right now. Please refresh in a moment.');return}
  const cards=$$('a[href^="game.html"]');
  const groups=[...new Set(cards.map(a=>a.parentElement).filter(Boolean))];
  let templates=cards;
  if(!cards.length){
    const heading=$$('h1,h2,h3').find(h=>/featured games|popular games|new games/i.test(h.textContent));
    const grid=heading?.parentElement?.parentElement;
    if(grid)templates=[...$$('a',grid)];
  }
  const list=templates;
  list.forEach((a,i)=>{
    const g=games[i];
    if(!g){a.remove();return}
    a.href=gameHref(g);
    const t=a.querySelector('h1,h2,h3,h4')||titleNode(a);if(t)t.textContent=g.title;
    const p=a.querySelector('p');if(p)p.textContent=g.category||'Browser game';
    const symbol=a.querySelector('.material-symbols-outlined,.cover-art');if(symbol)symbol.textContent=g.symbol||'✦';
    const img=a.querySelector('img');if(img){if(g.image_url){img.src=g.image_url;img.alt=g.title+' game artwork';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();a.style.background='linear-gradient(135deg,#72F2DC,#A6D8FF 55%,#DFBEFF)'}}else{img.remove();a.style.background='linear-gradient(135deg,#72F2DC,#A6D8FF 55%,#DFBEFF)';a.style.minHeight='190px';a.style.display='flex';a.style.flexDirection='column';a.style.justifyContent='flex-end'}}
    a.querySelectorAll('[data-design-text-token="label-sm"]').forEach(b=>{if(/featured|popular|new/i.test(b.textContent))b.parentElement?.remove()});
    a.dataset.gameTitle=g.title.toLowerCase();a.dataset.gameCategory=(g.category||'').toLowerCase();
  });
  const search=$('input[type="search"][aria-label="Search games"]');
  if(search){
    search.placeholder='Search games by name or category...';
    const main=$('main');
    const homeSections=[...(main?.children||[])];
    const results=document.createElement('section');
    results.className='max-w-7xl mx-auto w-full px-5 py-8';
    results.hidden=true;
    results.setAttribute('aria-live','polite');
    results.innerHTML='<div class="flex items-center justify-between gap-3 mb-5"><h2 class="font-display text-2xl text-navy-ink" data-search-heading>Search results</h2><span class="text-sm text-light-outline" data-search-count></span></div><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-search-results></div><p class="mt-5 text-center text-light-outline" data-search-empty hidden>No games match that search. Try another title or category.</p>';
    main?.prepend(results);
    const resultGrid=$('[data-search-results]',results);
    const countNode=$('[data-search-count]',results);
    const emptyNode=$('[data-search-empty]',results);
    const runSearch=()=>{
      const q=search.value.toLowerCase().trim();
      const active=!!q;
      results.hidden=!active;
      homeSections.forEach(node=>{node.hidden=active;node.style.display=active?'none':''});
      if(!active)return;
      const matches=games.filter(g=>([g.title,g.category,g.description,g.instructions].filter(Boolean).join(' ')).toLowerCase().includes(q));
      resultGrid.replaceChildren(...matches.map(gameCard));
      countNode.textContent=matches.length+' game'+(matches.length===1?'':'s');
      emptyNode.hidden=matches.length>0;
    };
    search.addEventListener('input',runSearch);
    search.addEventListener('keydown',e=>{
      if(e.key==='Escape'){search.value='';runSearch();search.blur()}
    });
    const searchForm=search.closest('form');
    searchForm?.addEventListener('submit',e=>{e.preventDefault();runSearch()});
  }
  const categoryLinks=$$('a').filter(a=>/all games|action|adventure|racing|puzzle|multiplayer|simulation|driving/i.test(a.textContent.trim())&&!a.href.includes('game.html'));
  categoryLinks.forEach(a=>a.addEventListener('click',e=>{
    const label=a.textContent.trim().toLowerCase();
    if(!['all games','all'].includes(label)){e.preventDefault();$$('a[data-game-category]').forEach(card=>card.hidden=card.dataset.gameCategory!==label)}
    else $$('a[data-game-category]').forEach(card=>card.hidden=false);
  }));
}

async function gamePage(){
  const id=new URLSearchParams(location.search).get('id');
  let games=[];try{games=await getGames()}catch{}
  const game=games.find(g=>g.id===id)||games[0];
  if(!game)return;
  document.title=game.title+' — Division';
  const title=$$('h1,h2').find(h=>/neon drift turbo|shadow blade duel/i.test(h.textContent))||$('h1');
  if(title)title.textContent=game.title;
  const about=$$('h2').find(h=>/about /i.test(h.textContent));
  if(about)about.textContent='About '+game.title;
  const description=$('[data-game-description]')||$$('p').find(p=>p.textContent.trim().length>45);
  if(description&&game.description)description.textContent=game.description;
  const launch=$$('a,button').find(a=>/play now|launch game|play game/i.test(a.textContent));
  const likeButton=$('[data-like]'),favoriteButton=$('[data-fav]'),fullButton=$('[data-fullscreen]');
  const refreshActions=async()=>{
    const {count}=await supabase.from('likes').select('*',{count:'exact',head:true}).eq('game_id',game.id);
    if(likeButton)likeButton.textContent='♥ '+(count||0)+' Likes';
    if(currentUser){
      const [{data:liked},{data:saved}]=await Promise.all([
        supabase.from('likes').select('user_id').eq('user_id',currentUser.id).eq('game_id',game.id).maybeSingle(),
        supabase.from('favorites').select('game_id').eq('user_id',currentUser.id).eq('game_id',game.id).maybeSingle()
      ]);
      if(likeButton)likeButton.dataset.active=liked?'true':'false';
      if(favoriteButton)favoriteButton.textContent=saved?'Saved':'Save';
    }
  };
  if(likeButton)likeButton.addEventListener('click',async()=>{
    if(!currentUser)return location.href='auth.html';
    const {data}=await supabase.from('likes').select('user_id').eq('user_id',currentUser.id).eq('game_id',game.id).maybeSingle();
    const result=data?await supabase.from('likes').delete().eq('user_id',currentUser.id).eq('game_id',game.id):await supabase.from('likes').insert({user_id:currentUser.id,game_id:game.id});
    if(result.error)injectNotice(result.error.message);else refreshActions();
  });
  if(favoriteButton)favoriteButton.addEventListener('click',async()=>{
    if(!currentUser)return location.href='auth.html';
    const {data}=await supabase.from('favorites').select('game_id').eq('user_id',currentUser.id).eq('game_id',game.id).maybeSingle();
    const result=data?await supabase.from('favorites').delete().eq('user_id',currentUser.id).eq('game_id',game.id):await supabase.from('favorites').insert({user_id:currentUser.id,game_id:game.id});
    if(result.error)injectNotice(result.error.message);else refreshActions();
  });
  if(fullButton)fullButton.addEventListener('click',()=>{
    const player=document.querySelector('.relative.aspect-video');
    if(player?.requestFullscreen)player.requestFullscreen().catch(()=>injectNotice('Fullscreen is not available in this browser.'));
  });
  refreshActions();

  let gameUrl='';
  try{const parsed=new URL(game.game_url||'');if(['https:','http:'].includes(parsed.protocol))gameUrl=parsed.href}catch{}
  if(launch&&gameUrl){
    launch.addEventListener('click',async e=>{
      e.preventDefault();
      const player=document.querySelector('.relative.aspect-video');
      if(player){
        player.replaceChildren();
        const frame=document.createElement('iframe');
        frame.src=gameUrl;frame.title=game.title+' game';frame.allow='fullscreen; autoplay; gamepad';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
        frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;background:#081748';
        player.style.position='relative';player.append(frame);
        const fallback=document.createElement('a');fallback.href=gameUrl;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='If the game does not load, open it on its website ↗';
        fallback.style.cssText='position:absolute;bottom:10px;left:10px;z-index:5;padding:8px 12px;border-radius:999px;background:rgba(8,23,72,.88);color:white;font:12px sans-serif';player.append(fallback);
      }else window.open(gameUrl,'_blank','noopener,noreferrer');
      if(currentUser){
        const {error:playEventError}=await supabase.from('game_plays').insert({game_id:game.id,user_id:currentUser.id});
        if(playEventError)console.warn('Could not record game launch:',playEventError.message);
        const {data:settingsRow}=await supabase.from('profiles').select('settings').eq('id',currentUser.id).maybeSingle();
        if(settingsRow?.settings?.save_history!==false){
          const {error}=await supabase.from('play_history').upsert({user_id:currentUser.id,game_id:game.id,played_at:new Date().toISOString()});
          if(error)console.warn('Could not save play history:',error.message);
        }
      }
    });
  }else if(launch){
    launch.addEventListener('click',e=>{e.preventDefault();injectNotice('This game does not have a playable URL yet.')});
  }

  // Game discussion: comments, replies, editing, deletion and likes.
  const commentsSection=document.createElement('section');
  commentsSection.id='comments';
  commentsSection.className='rounded-3xl border border-line/60 bg-white p-6 shadow-sm space-y-4';
  commentsSection.innerHTML='<div class="flex items-center justify-between gap-3"><h2 class="font-display text-2xl font-semibold">Comments <span data-comment-count class="text-base text-slate-500">0</span></h2><span class="text-sm text-slate-500">Newest first</span></div><form data-comment-form class="space-y-3"><textarea name="body" maxlength="1200" required placeholder="Share a tip, review, or your experience…" class="w-full min-h-24 rounded-2xl border border-line p-4"></textarea><div class="flex flex-wrap items-center justify-between gap-3"><p data-comment-message class="text-sm text-slate-500">'+(currentUser?'Posting as '+esc(profile.username||currentUser.email||'Player'):'Sign in to post a comment.')+'</p><div class="flex gap-2"><button type="button" data-cancel-reply hidden class="rounded-full border border-line px-4 py-2 text-sm">Cancel reply</button><button data-comment-submit class="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white" type="submit">Post comment</button></div></div></form><div data-comment-list class="space-y-3"><p class="text-sm text-slate-500">Loading comments…</p></div>';
  const gameMain=$('main');gameMain?.append(commentsSection);
  const commentList=$('[data-comment-list]',commentsSection),commentCount=$('[data-comment-count]',commentsSection),commentForm=$('[data-comment-form]',commentsSection),commentMessage=$('[data-comment-message]',commentsSection),commentInput=commentForm.elements.body,commentSubmit=$('[data-comment-submit]',commentForm),cancelReply=$('[data-cancel-reply]',commentForm);
  let replyTo=null,commentRows=[],commentLikes=new Set(),commentLikeCounts=new Map();
  const commentMessageText=(text,error=false)=>{say(commentMessage,text);commentMessage.dataset.error=error?'true':'false'};
  const makeCommentNode=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
  const action=(text,fn)=>{const b=makeCommentNode('button','text-sm font-semibold text-navy hover:underline',text);b.type='button';b.addEventListener('click',fn);return b};
  const renderComment=(row,isReply)=>{
    const card=makeCommentNode('article',isReply?'ml-6 sm:ml-12 border-l-2 border-line pl-4 py-3':'rounded-2xl bg-slate-50 p-4');
    const header=makeCommentNode('div','flex items-center gap-3');
    const img=makeCommentNode('img','h-9 w-9 rounded-full object-cover');img.alt='';img.src=row.profiles?.avatar_url||'assets/icons/avatar.svg';img.onerror=()=>{img.onerror=null;img.src='assets/icons/avatar.svg'};
    const userBox=makeCommentNode('div','min-w-0');
    userBox.append(makeCommentNode('p','font-semibold text-sm',row.profiles?.username||'Player'),makeCommentNode('time','text-xs text-slate-500',new Date(row.created_at).toLocaleString()+(row.updated_at&&row.updated_at!==row.created_at?' · edited':'')));
    header.append(img,userBox);card.append(header,makeCommentNode('p','mt-3 whitespace-pre-wrap break-words text-sm text-slate-700',row.body));
    const actions=makeCommentNode('div','mt-3 flex flex-wrap gap-3');
    const liked=commentLikes.has(row.id),likes=commentLikeCounts.get(row.id)||0;
    actions.append(action((liked?'♥ Liked':'♡ Like')+' ('+likes+')',async event=>{
      if(!currentUser){location.href='auth.html?next='+encodeURIComponent('game.html?id='+game.id+'#comments');return}
      const button=event.currentTarget;button.disabled=true;
      const result=liked?await supabase.from('comment_likes').delete().eq('user_id',currentUser.id).eq('comment_id',row.id):await supabase.from('comment_likes').insert({user_id:currentUser.id,comment_id:row.id});
      if(result.error)commentMessageText(result.error.message,true);else await loadGameComments();
      button.disabled=false;
    }));
    if(!isReply)actions.append(action('Reply',()=>{
      if(!currentUser){location.href='auth.html?next='+encodeURIComponent('game.html?id='+game.id+'#comments');return}
      replyTo=row.id;commentInput.placeholder='Reply to '+(row.profiles?.username||'player')+'…';commentSubmit.textContent='Post reply';cancelReply.hidden=false;commentInput.focus();
    }));
    if(currentUser&&row.user_id===currentUser.id)actions.append(action('Edit',()=>{
      const editor=makeCommentNode('textarea','mt-3 w-full rounded-xl border border-line p-3 text-sm');editor.maxLength=1200;editor.value=row.body;
      const save=makeCommentNode('button','mt-2 mr-3 text-sm font-semibold text-navy','Save edit');save.type='button';
      const cancel=makeCommentNode('button','mt-2 text-sm text-slate-500','Cancel');cancel.type='button';
      card.querySelector('[data-comment-body]')?.remove();
      const bodyNode=[...card.querySelectorAll('p')].find(p=>p.textContent===row.body);if(bodyNode)bodyNode.replaceWith(editor);else card.append(editor);
      actions.replaceChildren(save,cancel);
      cancel.onclick=()=>loadGameComments();
      save.onclick=async()=>{const body=editor.value.trim();if(!body||body.length>1200){commentMessageText('Comment must be 1–1200 characters.',true);return}save.disabled=true;const result=await supabase.from('comments').update({body,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',currentUser.id);if(result.error)commentMessageText(result.error.message,true);else{commentMessageText('Comment updated.');await loadGameComments()}};
    }));
    if(currentUser&&(row.user_id===currentUser.id||isAdmin))actions.append(action('Delete',async()=>{
      if(!confirm('Delete this comment'+(commentRows.some(r=>r.parent_id===row.id)?' and its replies':'')+'?'))return;
      const result=await supabase.from('comments').delete().eq('id',row.id);
      if(result.error)commentMessageText(result.error.message,true);else{commentMessageText('Comment deleted.');await loadGameComments()}
    }));
    card.append(actions);return card;
  };
  const loadGameComments=async()=>{
    const result=await supabase.from('comments').select('id,body,user_id,parent_id,created_at,updated_at,profiles(username,avatar_url)').eq('game_id',game.id).order('created_at',{ascending:false});
    if(result.error){commentList.textContent='Comments could not load right now.';commentMessageText(result.error.message,true);return}
    commentRows=result.data||[];commentCount.textContent=String(commentRows.length);commentLikes=new Set();commentLikeCounts=new Map();
    const ids=commentRows.map(r=>r.id);
    if(ids.length){
      const all=await supabase.from('comment_likes').select('comment_id').in('comment_id',ids);
      if(!all.error)(all.data||[]).forEach(l=>commentLikeCounts.set(l.comment_id,(commentLikeCounts.get(l.comment_id)||0)+1));
      if(currentUser){const own=await supabase.from('comment_likes').select('comment_id').eq('user_id',currentUser.id).in('comment_id',ids);if(!own.error)commentLikes=new Set((own.data||[]).map(l=>l.comment_id))}
    }
    commentList.replaceChildren();
    const roots=commentRows.filter(r=>!r.parent_id);
    if(!roots.length)commentList.append(makeCommentNode('p','text-sm text-slate-500','No comments yet. Be the first to comment.'));
    roots.forEach(root=>{
      const group=makeCommentNode('div','space-y-2');group.append(renderComment(root,false));
      commentRows.filter(r=>r.parent_id===root.id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).forEach(reply=>group.append(renderComment(reply,true)));
      commentList.append(group);
    });
    commentMessageText(currentUser?'Posting as '+esc(profile.username||currentUser.email||'Player'):'Sign in to post a comment.');
  };
  cancelReply.addEventListener('click',()=>{replyTo=null;commentInput.placeholder='Share a tip, review, or your experience…';commentSubmit.textContent='Post comment';cancelReply.hidden=true});
  commentForm.onsubmit=async e=>{
    e.preventDefault();if(!currentUser){location.href='auth.html?next='+encodeURIComponent('game.html?id='+game.id+'#comments');return}
    const body=commentInput.value.trim();if(!body||body.length>1200){commentMessageText('Comment must be 1–1200 characters.',true);return}
    commentSubmit.disabled=true;commentMessageText(replyTo?'Posting reply…':'Posting comment…');
    const result=await supabase.from('comments').insert({game_id:game.id,user_id:currentUser.id,body,parent_id:replyTo});
    commentSubmit.disabled=false;
    if(result.error){commentMessageText(result.error.message,true);return}
    commentInput.value='';replyTo=null;commentInput.placeholder='Share a tip, review, or your experience…';commentSubmit.textContent='Post comment';cancelReply.hidden=true;commentMessageText('Posted.');await loadGameComments();
  };
  await loadGameComments();

}
async function profilePage(){
  const main=$('main');
  const requested=new URLSearchParams(location.search).get('username');
  let target=profile;
  const viewingOther=!!requested&&requested.toLowerCase()!==String(profile.username||'').toLowerCase();
  if(viewingOther){
    const result=await supabase.from('profiles').select('username,first_name,last_name,bio,avatar_url,created_at').eq('username',requested).maybeSingle();
    if(result.error||!result.data){
      if(main)main.innerHTML='<section class="max-w-3xl mx-auto my-12 p-8 rounded-3xl bg-white"><h1 class="font-display text-3xl mb-3">Player not found</h1><p>This public profile does not exist or is unavailable.</p><a href="index.html" class="inline-block mt-5 underline">Back to games</a></section>';
      return;
    }
    target=result.data;
  }
  if(viewingOther){
    const emailNode=$('[data-profile-email]');if(emailNode)emailNode.textContent='Public player profile';
    const usernameHeading=$$('h1').find(h=>/your profile/i.test(h.textContent));if(usernameHeading)usernameHeading.textContent=target.username||'Player';
    const avatar=main?.querySelector('img[alt*="Profile"],img[alt*="profile"],img[alt*="avatar"]');
    if(avatar&&target.avatar_url)avatar.src=target.avatar_url;
    const settingsSection=$$('section').find(s=>/account settings/i.test(s.textContent));if(settingsSection)settingsSection.hidden=true;
    const signout=$$('[data-signout]')[0];if(signout)signout.hidden=true;
    const intro=main?.querySelector('section');
    if(intro){
      let bio=intro.querySelector('[data-public-bio]');
      if(!bio){bio=document.createElement('p');bio.dataset.publicBio='true';bio.className='mt-3 text-sm text-slate-600';intro.append(bio)}
      const fullName=[target.first_name,target.last_name].filter(Boolean).join(' ');
      bio.textContent=(fullName?fullName+' · ':'')+(target.bio||'No bio added yet.')+' · Joined '+new Date(target.created_at).toLocaleDateString();
    }
    const sections=$$('main > section');
    sections.filter(s=>/favourite games|recently played/i.test(s.textContent)).forEach(s=>s.hidden=true);
    return;
  }
  if(!currentUser){
    if(main)main.innerHTML='<section class="max-w-3xl mx-auto my-12 p-8 rounded-3xl bg-light-surface-container-low text-navy-ink"><h1 class="font-display text-3xl mb-3">Your Division profile</h1><p class="mb-5">Sign in to see your saved games and activity.</p><a href="auth.html" class="inline-block px-5 py-3 rounded-full bg-navy-ink text-white">Sign in</a></section>';
    return;
  }
  const name=profile.username||currentUser.email?.split('@')[0]||'Player';
  const emailNode=$('[data-profile-email]');if(emailNode)emailNode.textContent=currentUser.email||'';
  const profileImages=Array.from(document.querySelectorAll('img')).filter(img=>/avatar|profile picture/i.test(img.alt));
  profileImages.forEach(img=>{if(profile.avatar_url){img.src=profile.avatar_url;img.alt='Your profile picture'}});
  const photo=$('[data-profile-photo]');if(photo&&profile.avatar_url)photo.src=profile.avatar_url;
  const usernameInput=$('[data-profile-username]');
  if(usernameInput)usernameInput.value=name;
  const firstInput=$('[data-profile-first-name]');if(firstInput)firstInput.value=profile.first_name||'';
  const lastInput=$('[data-profile-last-name]');if(lastInput)lastInput.value=profile.last_name||'';
  const bioInput=$('[data-profile-bio]');if(bioInput)bioInput.value=profile.bio||'';

  const avatarInput=$('[data-avatar-file]'),avatarMessage=$('[data-avatar-message]');
  if(avatarInput)avatarInput.addEventListener('change',async()=>{
    const file=avatarInput.files&&avatarInput.files[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){say(avatarMessage,'Choose a JPG, PNG or WebP image.');avatarInput.value='';return}
    if(file.size>3*1024*1024){say(avatarMessage,'Image must be 3 MB or smaller.');avatarInput.value='';return}
    const choose=avatarInput.closest('label');if(choose)choose.classList.add('opacity-60');
    say(avatarMessage,'Uploading photo…');
    try{
      const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
      const path=currentUser.id+'/avatar.'+ext;
      const up=await supabase.storage.from('avatars').upload(path,file,{cacheControl:'3600',upsert:true,contentType:file.type});if(up.error)throw up.error;
      const url=supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl+'?v='+Date.now();
      const saved=await supabase.from('profiles').update({avatar_url:url}).eq('id',currentUser.id);if(saved.error)throw saved.error;
      profile.avatar_url=url;if(photo)photo.src=url;profileImages.forEach(img=>{img.src=url;img.alt='Your profile picture'});applyProfileAvatar(url);say(avatarMessage,'Profile photo updated.');
    }catch(err){say(avatarMessage,err.message||'Upload failed. Check your connection and try again.')}
    finally{avatarInput.value='';if(choose)choose.classList.remove('opacity-60')}
  });
  let removeButton=$('[data-avatar-remove]');
  if(photo&&!removeButton){
    removeButton=document.createElement('button');removeButton.type='button';removeButton.dataset.avatarRemove='true';removeButton.textContent='Remove photo';removeButton.className='ml-2 rounded-full border border-line px-4 py-2 text-sm font-semibold';
    photo.parentElement?.append(removeButton);
  }
  if(removeButton)removeButton.addEventListener('click',async()=>{
    removeButton.disabled=true;say(avatarMessage,'Removing photo…');
    const saved=await supabase.from('profiles').update({avatar_url:null}).eq('id',currentUser.id);
    if(saved.error)say(avatarMessage,saved.error.message);
    else{profile.avatar_url=null;const fallback='assets/icons/avatar.svg';if(photo)photo.src=fallback;profileImages.forEach(img=>img.src=fallback);applyProfileAvatar(fallback);say(avatarMessage,'Profile photo removed.')}
    removeButton.disabled=false;
  });

  const profileForm=$('[data-profile-form]');
  if(profileForm)profileForm.onsubmit=async e=>{
    e.preventDefault();
    const username=usernameInput?.value.trim()||'';
    const first_name=firstInput?.value.trim()||'';
    const last_name=lastInput?.value.trim()||'';
    const bio=bioInput?.value.trim()||'';
    if(!username){say($('[data-profile-message]',profileForm),'Username is required.');return}
    if(username.length<3||username.length>24||!/^[a-zA-Z0-9_]+$/.test(username)){say($('[data-profile-message]',profileForm),'Username must be 3–24 letters, numbers or underscores.');return}
    if(bio.length>240){say($('[data-profile-message]',profileForm),'Bio must be 240 characters or less.');return}
    const saveButton=profileForm.querySelector('button[type="submit"]');if(saveButton)saveButton.disabled=true;
    say($('[data-profile-message]',profileForm),'Saving profile…');
    const save=await supabase.from('profiles').update({username,first_name,last_name,bio}).eq('id',currentUser.id);
    say($('[data-profile-message]',profileForm),save.error?.message||'Profile saved.');
    if(!save.error){
      Object.assign(profile,{username,first_name,last_name,bio});
      document.querySelectorAll('a[href="profile.html"] span').forEach(n=>n.textContent=username);
      document.querySelectorAll('h1').forEach(h=>{if(/your profile/i.test(h.textContent))h.textContent=username});
    }
    if(saveButton)saveButton.disabled=false;
  };
  const signout=$$('[data-signout],button,a').find(n=>n.matches('[data-signout]')||/sign out|log out/i.test(n.textContent));
  if(signout)signout.onclick=async()=>{signout.disabled=true;const result=await supabase.auth.signOut();if(result.error){signout.disabled=false;say($('[data-profile-message]'),result.error.message)}else location.href='index.html'};
  const all=await getGames().catch(()=>[]);
  for(const [table,label] of [['favorites','Favourite Games'],['play_history','Recently Played']]){
    const heading=$$('h2,h3').find(h=>h.textContent.toLowerCase().includes(label.toLowerCase()));
    if(!heading)continue;
    const container=heading.closest('section')||heading.parentElement.parentElement;
    let grid=container.querySelector('.grid');if(!grid){grid=document.createElement('div');container.append(grid)}
    grid.className='grid grid-cols-2 md:grid-cols-3 gap-4 mt-4';grid.replaceChildren();
    const {data,error}=await supabase.from(table).select('game_id'+(table==='play_history'?',played_at':'')).eq('user_id',currentUser.id).order(table==='play_history'?'played_at':'created_at',{ascending:false}).limit(12);
    if(error){grid.append(makeProfileNotice(error.message));continue}
    (data||[]).forEach(row=>{const g=all.find(x=>x.id===row.game_id);if(g)grid.append(gameCard(g))});
    if(!grid.children.length)grid.append(makeProfileNotice('No games here yet.'));
  }
}
function makeProfileNotice(text){const p=document.createElement('p');p.className='text-light-outline';p.textContent=text;return p;}

async function adminPage(){
  const main=$('main')||document.body;
  if(!currentUser||!isAdmin){
    const notice=document.createElement('section');notice.className='max-w-4xl mx-auto my-12 p-8 rounded-3xl bg-light-surface-container-low text-navy-ink';
    notice.innerHTML='<h2 class="font-display text-2xl mb-3">Admin access required</h2><p class="font-body mb-4">'+(!currentUser?'Sign in with your admin account to manage Division.':'This account does not have the admin role.')+'</p><a class="inline-block px-5 py-3 rounded-full bg-navy-ink text-white" href="'+(!currentUser?'auth.html?next=admin':'index.html')+'">'+(!currentUser?'Sign in':'Back to games')+'</a>';
    main.replaceChildren(notice);
    document.body.style.visibility='visible';
    return;
  }
  document.body.style.visibility='visible';
  const metricQueries=[
    ['Total Games',supabase.from('games').select('*',{count:'exact',head:true}).eq('published',true)],
    ['Registered Users',supabase.from('profiles').select('*',{count:'exact',head:true})],
    ['Total Likes',supabase.from('likes').select('*',{count:'exact',head:true})]
  ];
  const metricResults=await Promise.all(metricQueries.map(async([label,query])=>({label,...await query})));
  metricResults.forEach(({label,count,error})=>{
    const card=$$('article').find(node=>node.querySelector('span')?.textContent.trim()===label);
    const value=card?.querySelector('[data-live-metric]');
    if(value)value.textContent=error?'—':(count??0).toLocaleString();
  });
  const heading=$$('h1,h2,h3').find(h=>/game management/i.test(h.textContent));
  const section=heading?.closest('section')||heading?.parentElement?.parentElement||main;
  const form=document.createElement('form');form.id='add-game';form.className='my-6 p-5 md:p-7 rounded-3xl bg-light-surface-container-low border border-light-outline-variant space-y-3';
  form.innerHTML='<h3 class="font-display text-2xl text-navy-ink">Add or edit a game</h3><div class="grid md:grid-cols-2 gap-3"><input name="id" required placeholder="Game ID (slug)" class="p-3 rounded-xl border"><input name="title" required placeholder="Game title" class="p-3 rounded-xl border"><input name="category" required placeholder="Category" class="p-3 rounded-xl border"><input name="symbol" placeholder="Cover symbol" maxlength="8" class="p-3 rounded-xl border"><input name="game_url" type="url" placeholder="Playable game URL (https://...)" class="p-3 rounded-xl border md:col-span-2"><input name="image_url" type="url" placeholder="Game image URL (https://...)" class="p-3 rounded-xl border md:col-span-2"><input name="cover_color" placeholder="Cover style class" value="cover-1" class="p-3 rounded-xl border md:col-span-2"><textarea name="description" placeholder="Description" class="p-3 rounded-xl border md:col-span-2"></textarea><textarea name="instructions" placeholder="Instructions" class="p-3 rounded-xl border md:col-span-2"></textarea></div><label class="flex items-center gap-2"><input name="published" type="checkbox" checked> Published</label><div class="flex gap-3"><button class="px-5 py-3 rounded-full bg-navy-ink text-white">Save game</button><button type="reset" class="px-5 py-3 rounded-full bg-white border">Clear</button></div><p data-msg class="text-sm"></p>';
  section.prepend(form);
  const list=document.createElement('div');list.className='space-y-3 mt-5';list.dataset.adminGames='true';form.after(list);
  const refresh=async()=>{
    const gs=await getGames(true).catch(()=>[]);
    const tbody=$('table tbody');
    list.hidden=true;
    if(tbody){
      const rows=await Promise.all(gs.map(async g=>{
        const {count}=await supabase.from('likes').select('*',{count:'exact',head:true}).eq('game_id',g.id);
        return '<tr class="border-b"><td class="px-4 py-3"><b>'+esc(g.title)+'</b><small class="block text-light-outline">'+esc(g.id)+'</small></td><td class="px-4 py-3">'+esc(g.category)+'</td><td class="px-4 py-3">'+(count||0)+'</td><td class="px-4 py-3">'+(g.published?'Published':'Hidden')+'</td><td class="px-4 py-3 text-right"><button type="button" data-edit="'+esc(g.id)+'" class="px-3 py-1 rounded-full border">Edit</button> <button type="button" data-delete="'+esc(g.id)+'" class="px-3 py-1 rounded-full bg-light-error-container text-light-error">Delete</button></td></tr>';
      }));
      tbody.innerHTML=rows.join('')||'<tr><td colspan="5" class="p-5">No games yet.</td></tr>';
    }
    list.innerHTML=gs.map(g=>'<article class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border"><div><b class="text-navy-ink">'+esc(g.title)+'</b><p class="text-sm text-light-outline">'+esc(g.id)+' · '+esc(g.category)+' · '+(g.published?'Published':'Hidden')+'</p></div><div class="flex gap-2"><button type="button" data-edit="'+esc(g.id)+'" class="px-4 py-2 rounded-full border">Edit</button><button type="button" data-delete="'+esc(g.id)+'" class="px-4 py-2 rounded-full bg-light-error-container text-light-error">Delete</button></div></article>').join('')||'<p>No games found.</p>';
    $$('[data-edit]',document).forEach(b=>b.onclick=()=>{
      const g=gs.find(x=>x.id===b.dataset.edit);if(!g)return;
      Object.keys(g).forEach(k=>{if(form.elements[k]&&form.elements[k].type!=='checkbox')form.elements[k].value=g[k]??''});
      form.elements.published.checked=!!g.published;form.dataset.editing=g.id;form.scrollIntoView({behavior:'smooth',block:'start'});
    });
    $$('[data-delete]',document).forEach(b=>b.onclick=async()=>{
      if(confirm('Delete this game? Related activity may also be affected.')){
        const {error}=await supabase.from('games').delete().eq('id',b.dataset.delete);
        if(error)say($('[data-msg]',form),error.message);else refresh();
      }
    });
  };
  form.onsubmit=async e=>{e.preventDefault();const f=form.elements,id=f.id.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-'),rec={id,title:f.title.value.trim(),category:f.category.value.trim().toLowerCase(),symbol:f.symbol.value.trim()||'✦',game_url:f.game_url.value.trim()||null,image_url:f.image_url.value.trim()||null,cover_color:f.cover_color.value.trim()||'cover-1',description:f.description.value.trim(),instructions:f.instructions.value.trim(),published:f.published.checked};const old=form.dataset.editing;const result=old?await supabase.from('games').update(rec).eq('id',old):await supabase.from('games').insert(rec);say($('[data-msg]',form),result.error?.message||'Game saved.');if(!result.error){delete form.dataset.editing;form.reset();f.cover_color.value='cover-1';f.published.checked=true;refresh()}};
  const adminSearch=$('input[type="search"]');
  if(adminSearch)adminSearch.addEventListener('input',()=>{
    const term=adminSearch.value.trim().toLowerCase();
    $$('table tbody tr').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(term));
  });
  await refresh();
}
const path=location.pathname.split('/').pop();
try{
  if(path==='index.html'||path===''||path==='')await homePage();
  if(path==='game.html')await gamePage();
  if(path==='profile.html')await profilePage();
  
  if(path==='admin.html')await adminPage();
}catch(error){console.error('Division page integration:',error);injectNotice('Some live features could not load. Refresh the page or check your connection.')}
