import {supabase,esc} from './client.js';
const $=s=>document.querySelector(s);
const grid=$('#game-grid'),search=$('#game-search'),count=$('#game-count'),overlay=$('#search-overlay'),overlaySearch=$('#overlay-search'),overlayResults=$('#overlay-results');
let allGames=[],activeCategory='all';
$('#year').textContent=new Date().getFullYear();
function gameCard(game){
 const title=esc(game.title||'Untitled game'),desc=esc(game.description||'Jump into the fun.');
 const category=esc(game.category||'arcade'),symbol=esc(game.symbol||'÷'),color=esc(game.cover_color||'#292a24');
 const cover=game.image_url?'<img loading="lazy" src="'+esc(game.image_url)+'" alt="">':'<span class="cover-symbol">'+symbol+'</span>';
 return '<a class="game-card" href="game.html?id='+encodeURIComponent(game.id)+'"><div class="game-cover" style="background:'+color+'">'+cover+'<span class="cover-tag">PLAY NOW</span></div><div class="game-info"><h3>'+title+'</h3><p>'+desc+'</p><div class="game-card-foot"><span class="game-category">'+category+'</span><span class="play-now">↗</span></div></div></a>';
}
function render(){
 const term=search.value.trim().toLowerCase();
 const filtered=allGames.filter(g=>{
  const category=String(g.category||'').toLowerCase();
  const categoryMatch=activeCategory==='all'||category===activeCategory||((g.tags||[]).map(x=>String(x).toLowerCase()).includes(activeCategory));
  const text=[g.title,g.description,g.category,...(g.tags||[])].join(' ').toLowerCase();
  return categoryMatch&&(!term||text.includes(term));
 });
 count.textContent=filtered.length;
 if(!filtered.length){grid.innerHTML='<div class="empty-state"><strong>No games found</strong><span>Try another search or category.</span></div>';return}
 grid.innerHTML=filtered.map(gameCard).join('');\n if(overlayResults)overlayResults.innerHTML=filtered.length?filtered.slice(0,8).map(gameCard).join(''):'<div class="empty-state">No matching games.</div>';
}
async function loadGames(){
 grid.innerHTML='<div class="loading-state"><span class="loader"></span><p>Loading the arcade…</p></div>';
 const {data,error}=await supabase.from('games').select('id,title,category,description,cover_color,symbol,game_url,image_url,tags,featured,popular,recommended,multiplayer').eq('published',true).order('created_at',{ascending:false});
 if(error){grid.innerHTML='<div class="empty-state"><strong>Could not load games</strong><span>Please refresh in a moment.</span></div>';console.error(error);return}
 allGames=data||[];render();
}
document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-category]').forEach(b=>b.classList.remove('selected'));
 button.classList.add('selected');activeCategory=button.dataset.category;render();
}));
search.addEventListener('input',render);
$('#search-clear').addEventListener('click',()=>{search.value='';render();search.focus()});
$('#search-open').addEventListener('click',()=>{overlay.hidden=false;overlaySearch.value=search.value;render();overlaySearch.focus()});\n$('#search-close').addEventListener('click',()=>overlay.hidden=true);\noverlay.addEventListener('click',e=>{if(e.target===overlay)overlay.hidden=true});\noverlaySearch.addEventListener('input',()=>{search.value=overlaySearch.value;render()});\ndocument.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.hidden=true});
try{const {data:{user}}=await supabase.auth.getUser();if(user){const {data:profile}=await supabase.from('profiles').select('username,avatar_url').eq('id',user.id).maybeSingle();const link=$('#account-link');link.href='profile.html';link.innerHTML=esc(profile?.username||'My account')+' <span>↗</span>'}}catch(e){console.warn('Account display unavailable',e)}
loadGames();
