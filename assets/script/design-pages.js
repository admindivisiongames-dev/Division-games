import { supabase, user, esc } from './client.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const say = (node, message) => { if (node) node.textContent = message; };
const currentUser = await user().catch(()=>null);
const profileResult = currentUser ? await supabase.from('profiles').select('username,role').eq('id',currentUser.id).maybeSingle() : {data:null};
const profile = profileResult.data || {};
const isAdmin = profile.role === 'admin';

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
  a.innerHTML='<div class="aspect-[16/10] bg-section-turquoise/40 flex items-center justify-center"><span class="font-display text-5xl text-navy-ink"></span></div><div class="p-4"><h3 class="font-display text-title-lg text-navy-ink"></h3><p class="font-body text-body-sm text-light-outline mt-1"></p></div>';
  $('div span',a).textContent=g.symbol||'✦';
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
  const navLinks=$$('a[href="auth.html"],a[href="profile.html"],a[href="index.html"]');
  if(currentUser){
    navLinks.filter(a=>/sign in|log in|create account/i.test(a.textContent)).forEach(a=>{a.href='profile.html';a.textContent=profile.username||'My Profile'});
  }
}
wireNavigation();

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
  const list=templates.filter(a=>a.querySelector('h3,h4'));
  list.forEach((a,i)=>{
    const g=games[i%Math.max(games.length,1)];
    if(!g)return;
    a.href=gameHref(g);
    const t=titleNode(a);if(t)t.textContent=g.title;
    const p=a.querySelector('p');if(p)p.textContent=g.category||'Browser game';
    const symbol=a.querySelector('.material-symbols-outlined,.cover-art');if(symbol)symbol.textContent=g.symbol||'✦';
    a.dataset.gameTitle=g.title.toLowerCase();a.dataset.gameCategory=(g.category||'').toLowerCase();
  });
  // Add a complete database-backed shelf without changing the supplied layout.
  const h=$$('h1,h2,h3').find(x=>/featured games/i.test(x.textContent));
  const section=h?.closest('section')||h?.parentElement?.parentElement;
  if(section&&!section.querySelector('[data-live-games]')){
    const shelf=document.createElement('div');shelf.dataset.liveGames='true';
    shelf.className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-6';
    games.slice(0,12).forEach(g=>shelf.append(gameCard(g)));
    section.append(shelf);
  }
  const search=$('input[type="search"][aria-label="Search games"]');
  const filter=()=>{
    const q=(search?.value||'').toLowerCase().trim();
    $$('a[data-game-title]').forEach(a=>a.hidden=!(a.dataset.gameTitle+' '+a.dataset.gameCategory).includes(q));
    $$('[data-live-games] a').forEach(a=>a.hidden=!((a.textContent||'').toLowerCase().includes(q)));
  };
  search?.addEventListener('input',filter);
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
  const headings=$$('h2');const about=headings.find(h=>/about /i.test(h.textContent));
  if(about)about.textContent='About '+game.title;
  const description=$$('p').find(p=>p.textContent.trim().length>45);
  if(description&&game.description)description.textContent=game.description;
  const controls=$$('h2,h3').find(h=>/player comments/i.test(h.textContent));
  const section=controls?.closest('section')||controls?.parentElement?.parentElement;
  if(!section)return;
  const panel=document.createElement('div');panel.className='mt-5 space-y-4';panel.innerHTML='<div class="flex flex-wrap items-center gap-3"><button data-like class="px-5 py-3 rounded-full bg-section-turquoise text-navy-ink font-label">♡ Like <span data-like-count>0</span></button><button data-fav class="px-5 py-3 rounded-full bg-section-yellow/60 text-navy-ink font-label">☆ Save</button></div><div data-comments class="space-y-3"></div><form data-comment-form class="mt-4 space-y-3"><textarea maxlength="1200" required placeholder="Write a comment..." class="w-full min-h-24 p-4 rounded-2xl border border-light-outline-variant bg-light-surface-container-lowest"></textarea><button class="px-6 py-3 rounded-full bg-navy-ink text-white font-label">Post comment</button><p data-comment-message class="text-sm"></p></form>';
  section.append(panel);
  const likeBtn=$('[data-like]',panel),favBtn=$('[data-fav]',panel),countNode=$('[data-like-count]',panel);
  const refreshLikes=async()=>{
    const {count}=await supabase.from('likes').select('*',{count:'exact',head:true}).eq('game_id',game.id);
    countNode.textContent=count||0;
    if(currentUser){const {data}=await supabase.from('likes').select('user_id').eq('user_id',currentUser.id).eq('game_id',game.id).maybeSingle();likeBtn.textContent=(data?'♥':'♡')+' Like '+(count||0)}
  };
  const refreshFav=async()=>{if(!currentUser)return;const {data}=await supabase.from('favorites').select('game_id').eq('user_id',currentUser.id).eq('game_id',game.id).maybeSingle();favBtn.textContent=data?'★ Saved':'☆ Save'};
  likeBtn.onclick=async()=>{if(!currentUser)return location.href='auth.html';const {data}=await supabase.from('likes').select('user_id').eq('user_id',currentUser.id).eq('game_id',game.id).maybeSingle();const r=data?await supabase.from('likes').delete().eq('user_id',currentUser.id).eq('game_id',game.id):await supabase.from('likes').insert({user_id:currentUser.id,game_id:game.id});if(r.error)injectNotice(r.error.message);await refreshLikes()};
  favBtn.onclick=async()=>{if(!currentUser)return location.href='auth.html';const {data}=await supabase.from('favorites').select('game_id').eq('user_id',currentUser.id).eq('game_id',game.id).maybeSingle();const r=data?await supabase.from('favorites').delete().eq('user_id',currentUser.id).eq('game_id',game.id):await supabase.from('favorites').insert({user_id:currentUser.id,game_id:game.id});if(r.error)injectNotice(r.error.message);await refreshFav()};
  const loadComments=async()=>{const {data,error}=await supabase.from('comments').select('id,body,created_at,user_id,profiles(username)').eq('game_id',game.id).order('created_at',{ascending:false});const box=$('[data-comments]',panel);if(error){box.textContent='Comments are temporarily unavailable.';return}box.innerHTML=(data||[]).map(c=>'<article class="p-4 rounded-2xl bg-light-surface-container-low"><div class="flex justify-between gap-3"><b class="text-navy-ink">'+esc(c.profiles?.username||'Player')+'</b><small class="text-light-outline">'+new Date(c.created_at).toLocaleDateString()+'</small></div><p class="mt-2 text-navy-ink">'+esc(c.body)+'</p>'+(isAdmin||c.user_id===currentUser?.id?'<button data-remove-comment="'+c.id+'" class="mt-2 text-sm text-light-error">Remove</button>':'')+'</article>').join('')||'<p class="text-light-outline">No comments yet.</p>';$$('[data-remove-comment]',box).forEach(b=>b.onclick=async()=>{if(confirm('Remove this comment?')){const {error}=await supabase.from('comments').delete().eq('id',b.dataset.removeComment);if(error)injectNotice(error.message);else loadComments()}})};
  $('[data-comment-form]',panel).onsubmit=async e=>{e.preventDefault();if(!currentUser)return location.href='auth.html';const ta=$('textarea',e.currentTarget),body=ta.value.trim();if(!body)return;const {error}=await supabase.from('comments').insert({game_id:game.id,user_id:currentUser.id,body});say($('[data-comment-message]',panel),error?.message||'Comment posted.');if(!error){ta.value='';await loadComments()}};
  await Promise.all([refreshLikes(),refreshFav(),loadComments()]);
  const launch=$$('a,button').find(a=>/play now|launch game|play game/i.test(a.textContent));
  if(launch){if(game.game_url){launch.href=game.game_url;launch.target='_blank';launch.rel='noopener noreferrer'}else{launch.addEventListener('click',e=>{e.preventDefault();injectNotice('This listing is ready, but its game URL has not been added by an admin yet.')})}}
}

async function profilePage(){
  if(!currentUser){injectNotice('Please sign in to view your profile.');return}
  const name=profile.username||currentUser.email?.split('@')[0]||'Player';
  $$('h1,h2,h3').forEach(h=>{if(/pixelace_99/i.test(h.textContent))h.textContent=name});
  $$('input').forEach(input=>{if(input.type==='text'&&input.value==='PixelAce_99')input.value=name;if(input.type==='email'&&input.value.includes('@division.gg'))input.value=currentUser.email||''});
  const userName=$$('p,span,div').find(n=>n.childElementCount===0&&n.textContent.trim()==='PixelAce_99');if(userName)userName.textContent=name;
  const signout=$$('button,a').find(n=>/sign out|log out/i.test(n.textContent));if(signout)signout.onclick=async()=>{await supabase.auth.signOut();location.href='index.html'};
  const all=await getGames().catch(()=>[]);
  for(const [table,label] of [['favorites','Favourite Games'],['play_history','Recently Played']]){
    const heading=$$('h2,h3').find(h=>h.textContent.toLowerCase().includes(label.toLowerCase()));
    if(!heading)continue;
    const container=heading.closest('section')||heading.parentElement.parentElement;
    const grid=document.createElement('div');grid.className='grid grid-cols-2 md:grid-cols-3 gap-4 mt-4';
    const {data}=await supabase.from(table).select('game_id'+(table==='play_history'?',played_at':'')).eq('user_id',currentUser.id).order(table==='play_history'?'played_at':'created_at',{ascending:false}).limit(12);
    (data||[]).forEach(row=>{const g=all.find(x=>x.id===row.game_id);if(g)grid.append(gameCard(g))});
    if(!grid.children.length)grid.innerHTML='<p class="text-light-outline">No games here yet.</p>';
    container.append(grid);
  }
  const settings=$$('h2,h3').find(h=>/account settings/i.test(h.textContent));
  if(settings){const section=settings.closest('section')||settings.parentElement.parentElement;const form=document.createElement('form');form.className='mt-4 space-y-3';form.innerHTML='<label class="block text-sm">Username<input name="username" maxlength="24" required class="block mt-2 w-full rounded-xl border p-3" value="'+esc(name)+'"></label><button class="px-5 py-3 rounded-full bg-navy-ink text-white">Save profile</button><p data-msg class="text-sm"></p>';section.append(form);form.onsubmit=async e=>{e.preventDefault();const username=form.elements.username.value.trim();const {error}=await supabase.from('profiles').update({username}).eq('id',currentUser.id);say($('[data-msg]',form),error?.message||'Profile saved.');if(!error)location.reload()}}
}

async function commentsPage(){
  const gameId=new URLSearchParams(location.search).get('id');
  let games=[];try{games=await getGames()}catch{}
  const game=games.find(g=>g.id===gameId)||games[0];if(!game)return;
  const heading=$$('h1,h2').find(h=>/comments|likes/i.test(h.textContent));if(heading)heading.textContent='Comments & Likes · '+game.title;
  const area=document.createElement('section');area.className='max-w-5xl mx-auto p-5 space-y-4';area.innerHTML='<div data-thread class="space-y-3"></div><form data-thread-form class="space-y-3"><textarea required maxlength="1200" placeholder="Join the conversation..." class="w-full p-4 rounded-2xl border"></textarea><button class="px-6 py-3 rounded-full bg-navy-ink text-white">Post</button><p data-msg></p></form>';
  const anchor=heading?.closest('section')||document.querySelector('main');(anchor||document.body).append(area);
  const load=async()=>{const {data,error}=await supabase.from('comments').select('body,created_at,profiles(username)').eq('game_id',game.id).order('created_at',{ascending:false});$('[data-thread]',area).innerHTML=error?'Unable to load comments.':(data||[]).map(c=>'<article class="p-4 rounded-xl bg-light-surface-container-low"><b>'+esc(c.profiles?.username||'Player')+'</b><p class="mt-2">'+esc(c.body)+'</p></article>').join('')||'<p>No comments yet.</p>'};
  $('[data-thread-form]',area).onsubmit=async e=>{e.preventDefault();if(!currentUser)return location.href='auth.html';const ta=$('textarea',e.currentTarget);const {error}=await supabase.from('comments').insert({game_id:game.id,user_id:currentUser.id,body:ta.value.trim()});say($('[data-msg]',area),error?.message||'Posted.');if(!error){ta.value='';load()}};
  load();
}

async function adminPage(){
  const main=$('main')||document.body;
  if(!currentUser||!isAdmin){
    const notice=document.createElement('section');notice.className='max-w-4xl mx-auto my-12 p-8 rounded-3xl bg-light-surface-container-low text-navy-ink';
    notice.innerHTML='<h2 class="font-display text-2xl mb-3">Admin access required</h2><p class="font-body mb-4">'+(!currentUser?'Sign in with your admin account to manage Division.':'This account does not have the admin role.')+'</p><a class="inline-block px-5 py-3 rounded-full bg-navy-ink text-white" href="'+(!currentUser?'auth.html':'index.html')+'">'+(!currentUser?'Sign in':'Back to games')+'</a>';
    main.replaceChildren(notice);return;
  }
  const heading=$$('h1,h2,h3').find(h=>/game management/i.test(h.textContent));
  const section=heading?.closest('section')||heading?.parentElement?.parentElement||main;
  const form=document.createElement('form');form.className='my-6 p-5 md:p-7 rounded-3xl bg-light-surface-container-low border border-light-outline-variant space-y-3';
  form.innerHTML='<h3 class="font-display text-2xl text-navy-ink">Add or edit a game</h3><div class="grid md:grid-cols-2 gap-3"><input name="id" required placeholder="Game ID (slug)" class="p-3 rounded-xl border"><input name="title" required placeholder="Game title" class="p-3 rounded-xl border"><input name="category" required placeholder="Category" class="p-3 rounded-xl border"><input name="symbol" placeholder="Cover symbol" maxlength="8" class="p-3 rounded-xl border"><input name="game_url" type="url" placeholder="Playable game URL (https://...)" class="p-3 rounded-xl border md:col-span-2"><input name="cover_color" placeholder="Cover style class" value="cover-1" class="p-3 rounded-xl border md:col-span-2"><textarea name="description" placeholder="Description" class="p-3 rounded-xl border md:col-span-2"></textarea><textarea name="instructions" placeholder="Instructions" class="p-3 rounded-xl border md:col-span-2"></textarea></div><label class="flex items-center gap-2"><input name="published" type="checkbox" checked> Published</label><label class="flex items-center gap-2"><input name="is_demo" type="checkbox"> Demo listing</label><div class="flex gap-3"><button class="px-5 py-3 rounded-full bg-navy-ink text-white">Save game</button><button type="reset" class="px-5 py-3 rounded-full bg-white border">Clear</button></div><p data-msg class="text-sm"></p>';
  section.prepend(form);
  const list=document.createElement('div');list.className='space-y-3 mt-5';list.dataset.adminGames='true';form.after(list);
  const refresh=async()=>{
    const gs=await getGames(true).catch(()=>[]);
    const tbody=$('table tbody');
    list.hidden=true;
    if(tbody){
      const rows=await Promise.all(gs.map(async g=>{
        const {count}=await supabase.from('likes').select('*',{count:'exact',head:true}).eq('game_id',g.id);
        return '<tr class="border-b"><td class="px-4 py-3"><b>'+esc(g.title)+'</b><small class="block text-light-outline">'+esc(g.id)+'</small></td><td class="px-4 py-3">'+esc(g.category)+'</td><td class="px-4 py-3">—</td><td class="px-4 py-3">'+(count||0)+'</td><td class="px-4 py-3">'+(g.published?'Published':'Hidden')+'</td><td class="px-4 py-3 text-right"><button type="button" data-edit="'+esc(g.id)+'" class="px-3 py-1 rounded-full border">Edit</button> <button type="button" data-delete="'+esc(g.id)+'" class="px-3 py-1 rounded-full bg-light-error-container text-light-error">Delete</button></td></tr>';
      }));
      tbody.innerHTML=rows.join('')||'<tr><td colspan="6" class="p-5">No games yet.</td></tr>';
    }
    list.innerHTML=gs.map(g=>'<article class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border"><div><b class="text-navy-ink">'+esc(g.title)+'</b><p class="text-sm text-light-outline">'+esc(g.id)+' · '+esc(g.category)+' · '+(g.published?'Published':'Hidden')+'</p></div><div class="flex gap-2"><button type="button" data-edit="'+esc(g.id)+'" class="px-4 py-2 rounded-full border">Edit</button><button type="button" data-delete="'+esc(g.id)+'" class="px-4 py-2 rounded-full bg-light-error-container text-light-error">Delete</button></div></article>').join('')||'<p>No games found.</p>';
    $$('[data-edit]',document).forEach(b=>b.onclick=()=>{
      const g=gs.find(x=>x.id===b.dataset.edit);if(!g)return;
      Object.keys(g).forEach(k=>{if(form.elements[k]&&form.elements[k].type!=='checkbox')form.elements[k].value=g[k]??''});
      form.elements.published.checked=!!g.published;form.elements.is_demo.checked=!!g.is_demo;form.dataset.editing=g.id;form.scrollIntoView({behavior:'smooth',block:'start'});
    });
    $$('[data-delete]',document).forEach(b=>b.onclick=async()=>{
      if(confirm('Delete this game? Related activity may also be affected.')){
        const {error}=await supabase.from('games').delete().eq('id',b.dataset.delete);
        if(error)say($('[data-msg]',form),error.message);else refresh();
      }
    });
  };
  form.onsubmit=async e=>{e.preventDefault();const f=form.elements,id=f.id.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-'),rec={id,title:f.title.value.trim(),category:f.category.value.trim().toLowerCase(),symbol:f.symbol.value.trim()||'✦',game_url:f.game_url.value.trim()||null,cover_color:f.cover_color.value.trim()||'cover-1',description:f.description.value.trim(),instructions:f.instructions.value.trim(),published:f.published.checked,is_demo:f.is_demo.checked};const old=form.dataset.editing;const result=old?await supabase.from('games').update(rec).eq('id',old):await supabase.from('games').insert(rec);say($('[data-msg]',form),result.error?.message||'Game saved.');if(!result.error){delete form.dataset.editing;form.reset();f.cover_color.value='cover-1';f.published.checked=true;refresh()}};
  await refresh();
}
const path=location.pathname.split('/').pop();
try{
  if(path==='index.html'||path===''||path==='')await homePage();
  if(path==='game.html')await gamePage();
  if(path==='profile.html')await profilePage();
  if(path==='comments.html')await commentsPage();
  if(path==='admin.html')await adminPage();
}catch(error){console.error('Division page integration:',error);injectNotice('Some live features could not load. Refresh the page or check your connection.')}
