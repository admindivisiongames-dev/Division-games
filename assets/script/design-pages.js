import { supabase, user, esc } from './client.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const say = (node, message) => { if (node) node.textContent = message; };
const currentUser = await user().catch(()=>null);
const profileResult = currentUser ? await supabase.from('profiles').select('username,role,avatar_url,created_at').eq('id',currentUser.id).maybeSingle() : {data:null};
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

  // Real community comments for the selected game.
  const commentsSection=document.createElement('section');
  commentsSection.id='comments';
  commentsSection.className='rounded-3xl border border-line/60 bg-white p-6 shadow-sm space-y-4';
  commentsSection.innerHTML='<div class="flex items-center justify-between gap-3"><h2 class="font-display text-2xl font-semibold">Comments <span data-comment-count class="text-base text-slate-500">0</span></h2><span class="text-sm text-slate-500">Newest first</span></div><div data-comment-list class="space-y-3"><p class="text-sm text-slate-500">Loading comments…</p></div><form data-comment-form class="space-y-3"><textarea name="body" maxlength="1200" required placeholder="Share a tip, review, or your experience…" class="w-full min-h-24 rounded-2xl border border-line p-4"></textarea><div class="flex flex-wrap items-center justify-between gap-3"><p data-comment-message class="text-sm text-slate-500">'+(currentUser?'Posting as '+esc(profile.username||currentUser.email||'Player'):'Sign in to post a comment.')+'</p><button class="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white" type="submit">Post comment</button></div></form>';
  const gameMain=$('main');
  gameMain?.append(commentsSection);
  const commentList=$('[data-comment-list]',commentsSection);
  const commentCount=$('[data-comment-count]',commentsSection);
  const commentForm=$('[data-comment-form]',commentsSection);
  const commentMessage=$('[data-comment-message]',commentsSection);
  const loadGameComments=async()=>{
    const {data,error}=await supabase.from('comments').select('id,body,user_id,created_at,profiles(username,avatar_url)').eq('game_id',game.id).order('created_at',{ascending:false});
    if(error){commentList.textContent='Comments could not load right now.';return}
    commentCount.textContent=String(data?.length||0);
    if(!data?.length){commentList.innerHTML='<p class="text-sm text-slate-500">No comments yet. Be the first to comment.</p>';return}
    commentList.innerHTML=data.map(c=>'<article class="rounded-2xl bg-slate-50 p-4" data-comment-id="'+esc(c.id)+'"><div class="flex items-center gap-3"><img class="h-9 w-9 rounded-full object-cover" src="'+esc(c.profiles?.avatar_url||'assets/icons/avatar.svg')+'" alt="" onerror="this.onerror=null;this.src=\'assets/icons/avatar.svg\'"><div class="min-w-0"><p class="font-semibold text-navy">'+esc(c.profiles?.username||'Player')+'</p><time class="text-xs text-slate-500">'+new Date(c.created_at).toLocaleString()+'</time></div></div><p data-comment-body class="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">'+esc(c.body)+'</p>'+(currentUser&&(c.user_id===currentUser.id||isAdmin)?'<div class="mt-3 flex gap-3"><button type="button" data-edit-comment="'+esc(c.id)+'" class="text-sm font-semibold text-navy">Edit</button><button type="button" data-delete-comment="'+esc(c.id)+'" class="text-sm font-semibold text-red-600">Delete</button></div>':'')+'</article>').join('');
    $('[data-delete-comment]',commentList).forEach(button=>button.onclick=async()=>{if(!confirm('Delete this comment?'))return;const {error}=await supabase.from('comments').delete().eq('id',button.dataset.deleteComment);if(error)say(commentMessage,error.message);else await loadGameComments()});
    $('[data-edit-comment]',commentList).forEach(button=>button.onclick=()=>{
      const article=button.closest('article'),bodyNode=$('[data-comment-body]',article),original=bodyNode.textContent;
      const editor=document.createElement('textarea');editor.maxLength=1200;editor.value=original;editor.className='mt-3 w-full rounded-xl border p-3 text-sm';
      const save=document.createElement('button');save.type='button';save.textContent='Save edit';save.className='mt-2 mr-3 text-sm font-semibold text-navy';
      const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.className='mt-2 text-sm text-slate-500';
      bodyNode.replaceWith(editor);button.parentElement.replaceChildren(save,cancel);
      cancel.onclick=()=>loadGameComments();
      save.onclick=async()=>{const body=editor.value.trim();if(!body)return;const {error}=await supabase.from('comments').update({body}).eq('id',button.dataset.editComment).eq('user_id',currentUser.id);if(error)say(commentMessage,error.message);else await loadGameComments()};
    });
  };
  commentForm.onsubmit=async e=>{e.preventDefault();if(!currentUser){location.href='auth.html?next='+encodeURIComponent('game.html?id='+game.id+'#comments');return}const body=commentForm.elements.body.value.trim();if(!body)return;const submit=commentForm.querySelector('button[type="submit"]');submit.disabled=true;const {error}=await supabase.from('comments').insert({game_id:game.id,user_id:currentUser.id,body});submit.disabled=false;say(commentMessage,error?.message||'Comment posted.');if(!error){commentForm.reset();await loadGameComments()}};
  await loadGameComments();

}
async function profilePage(){
  if(!currentUser){const main=$('main');if(main)main.innerHTML='<section class="max-w-3xl mx-auto my-12 p-8 rounded-3xl bg-light-surface-container-low text-navy-ink"><h1 class="font-display text-3xl mb-3">Your Division profile</h1><p class="mb-5">Sign in to see your saved games and activity.</p><a href="auth.html" class="inline-block px-5 py-3 rounded-full bg-navy-ink text-white">Sign in</a></section>';return}
  const name=profile.username||currentUser.email?.split('@')[0]||'Player';
  const emailNode=$('[data-profile-email]');if(emailNode)emailNode.textContent=currentUser.email||'';
  const profileImages=Array.from(document.querySelectorAll('img')).filter(img=>/avatar|profile picture/i.test(img.alt));
  const mainAvatar=profileImages.find(img=>/profile picture/i.test(img.alt))||profileImages[0];
  profileImages.forEach(img=>{if(profile.avatar_url){img.src=profile.avatar_url;img.alt='Your profile picture'}});
  if(mainAvatar&&!mainAvatar.dataset.uploadControl){
    mainAvatar.dataset.uploadControl='true';
    const wrapper=document.createElement('div');
    wrapper.className='flex flex-col items-center gap-2 shrink-0';
    mainAvatar.parentElement.insertBefore(wrapper,mainAvatar);
    wrapper.append(mainAvatar);
    mainAvatar.className='w-20 h-20 rounded-xl object-cover shadow-md border-2 border-section-turquoise';
    const picker=document.createElement('input');
    picker.type='file';picker.accept='image/png,image/jpeg,image/webp';picker.hidden=true;
    const choose=document.createElement('button');
    choose.type='button';choose.textContent='Change photo';
    choose.className='px-3 py-1.5 rounded-full bg-navy-ink text-white text-xs font-label';
    choose.addEventListener('click',()=>picker.click());
    const status=document.createElement('p');status.className='text-xs text-light-outline text-center';status.setAttribute('aria-live','polite');
    picker.addEventListener('change',async()=>{
      const file=picker.files?.[0];if(!file)return;
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)){status.textContent='Choose a JPG, PNG or WebP image.';picker.value='';return}
      if(file.size>3*1024*1024){status.textContent='Image must be 3 MB or smaller.';picker.value='';return}
      choose.disabled=true;status.textContent='Uploading photo…';
      try{
        const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
        const path=currentUser.id+'/avatar.'+ext;
        const {error:uploadError}=await supabase.storage.from('avatars').upload(path,file,{cacheControl:'3600',upsert:true,contentType:file.type});
        if(uploadError)throw uploadError;
        const {data}=supabase.storage.from('avatars').getPublicUrl(path);
        const avatarUrl=data.publicUrl+'?v='+Date.now();
        const {error:profileError}=await supabase.from('profiles').update({avatar_url:avatarUrl}).eq('id',currentUser.id);
        if(profileError)throw profileError;
        profile.avatar_url=avatarUrl;
        profileImages.forEach(img=>{img.src=avatarUrl;img.alt='Your profile picture'});
        applyProfileAvatar(avatarUrl);
        status.textContent='Profile photo updated.';
      }catch(error){status.textContent=error.message||'Could not upload photo. Please try again.'}
      finally{choose.disabled=false;picker.value=''}
    });
    wrapper.append(choose,picker,status);
  }
  document.querySelectorAll('h1').forEach(h=>{if(/your profile/i.test(h.textContent))h.textContent=name});
  const signout=$$('[data-signout],button,a').find(n=>n.matches('[data-signout]')||/sign out|log out/i.test(n.textContent));if(signout)signout.onclick=async()=>{await supabase.auth.signOut();location.href='index.html'};
  const all=await getGames().catch(()=>[]);
  for(const [table,label] of [['favorites','Favourite Games'],['play_history','Recently Played']]){
    const heading=$$('h2,h3').find(h=>h.textContent.toLowerCase().includes(label.toLowerCase()));
    if(!heading)continue;
    const container=heading.closest('section')||heading.parentElement.parentElement;
    let grid=container.querySelector('.grid');if(!grid){grid=document.createElement('div');container.append(grid)}grid.className='grid grid-cols-2 md:grid-cols-3 gap-4 mt-4';grid.replaceChildren();
    const {data}=await supabase.from(table).select('game_id'+(table==='play_history'?',played_at':'')).eq('user_id',currentUser.id).order(table==='play_history'?'played_at':'created_at',{ascending:false}).limit(12);
    (data||[]).forEach(row=>{const g=all.find(x=>x.id===row.game_id);if(g)grid.append(gameCard(g))});
    if(!grid.children.length)grid.innerHTML='<p class="text-light-outline">No games here yet.</p>';
    container.append(grid);
  }
  const settings=$$('h2,h3').find(h=>/account settings/i.test(h.textContent));
  if(settings){const section=settings.closest('section')||settings.parentElement.parentElement;const form=document.createElement('form');form.className='mt-4 space-y-3';form.innerHTML='<label class="block text-sm">Username<input name="username" maxlength="24" required class="block mt-2 w-full rounded-xl border p-3" value="'+esc(name)+'"></label><button class="px-5 py-3 rounded-full bg-navy-ink text-white">Save profile</button><p data-msg class="text-sm"></p>';section.append(form);form.onsubmit=async e=>{e.preventDefault();const username=form.elements.username.value.trim();const {error}=await supabase.from('profiles').update({username}).eq('id',currentUser.id);say($('[data-msg]',form),error?.message||'Profile saved.');if(!error)location.reload()}}
}

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
