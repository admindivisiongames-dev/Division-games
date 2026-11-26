import { supabase, user, esc } from './client.js';

const adminEmail = 'admin.division.games@gmail.com';
const main = document.querySelector('main');
const current = await user().catch(() => null);
if (!main || !current || current.email?.toLowerCase() !== adminEmail) {
  // The existing admin page already handles the access-denied state.
} else {
  const profile = await supabase.from('profiles').select('role').eq('id', current.id).maybeSingle();
  if (profile.data?.role === 'admin') {
    const section = (title, description) => {
      const el = document.createElement('section');
      el.className = 'mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-7';
      const h = document.createElement('h2'); h.className = 'font-display text-2xl font-semibold'; h.textContent = title;
      const p = document.createElement('p'); p.className = 'mt-1 text-sm text-slate-500'; p.textContent = description;
      el.append(h, p); return el;
    };
    const message = (node, text, error) => { node.textContent = text || ''; node.dataset.error = error ? 'true' : 'false'; };
    const make = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; };

    const stats = section('Platform statistics', 'Live counts from the Division database.');
    const statGrid = make('div','mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4');
    const statNames = ['Published games','Unpublished games','Game plays','Comments','Game likes','Comment likes','Players'];
    const statNodes = {};
    statNames.forEach(name => {
      const card=make('article','rounded-xl border border-slate-200 p-4');
      card.append(make('p','text-xs text-slate-500',name),make('p','mt-2 text-2xl font-semibold','—'));
      statNodes[name]=card.lastElementChild;statGrid.append(card);
    });
    const statsStatus=make('p','mt-3 text-sm');
    stats.append(statGrid,statsStatus);
    main.append(stats);

    const players = section('Player management','Search players and suspend or reactivate participation. Suspended players can still sign in but cannot post, like, save, or record new plays.');
    const playerSearch=make('input','mt-4 w-full max-w-lg rounded-xl border border-slate-300 p-3');
    playerSearch.type='search';playerSearch.placeholder='Search usernames or names…';playerSearch.setAttribute('aria-label','Search players');
    const playerStatus=make('p','mt-3 text-sm');
    const playerList=make('div','mt-4 space-y-3');
    players.append(playerSearch,playerStatus,playerList);main.append(players);
    let playerRows=[];
    async function loadPlayers(){
      message(playerStatus,'Loading players…');
      const result=await supabase.from('profiles').select('id,username,first_name,last_name,created_at,suspended,role,avatar_url').order('created_at',{ascending:false}).limit(300);
      if(result.error){message(playerStatus,result.error.message,true);return}
      playerRows=result.data||[];renderPlayers();
    }
    function renderPlayers(){
      const term=playerSearch.value.trim().toLowerCase();
      const rows=playerRows.filter(p=>([p.username,p.first_name,p.last_name].filter(Boolean).join(' ')).toLowerCase().includes(term));
      playerList.replaceChildren();
      if(!rows.length)playerList.append(make('p','text-sm text-slate-500','No matching players.'));
      rows.forEach(p=>{
        const row=make('article','flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3');
        const left=make('div','flex min-w-0 items-center gap-3');
        const img=make('img','h-10 w-10 rounded-full object-cover');img.src=p.avatar_url||'assets/icons/avatar.svg';img.alt='';img.onerror=()=>img.src='assets/icons/avatar.svg';
        const info=make('div','min-w-0');info.append(make('p','font-semibold text-sm',p.username||'Player'),make('p','text-xs text-slate-500',[p.first_name,p.last_name].filter(Boolean).join(' ')+' · Joined '+new Date(p.created_at).toLocaleDateString()));
        left.append(img,info);row.append(left);
        const status=make('span','text-xs font-semibold',p.suspended?'Suspended':'Active');
        const button=make('button','rounded-full border px-4 py-2 text-sm font-semibold',p.suspended?'Reactivate':'Suspend');
        button.type='button';button.disabled=p.id===current.id||p.role==='admin';
        button.title=button.disabled?'Admin accounts cannot be suspended here':'';
        button.addEventListener('click',async()=>{
          button.disabled=true;message(playerStatus,(p.suspended?'Reactivating ':'Suspending ')+(p.username||'player')+'…');
          const result=await supabase.from('profiles').update({suspended:!p.suspended}).eq('id',p.id);
          if(result.error)message(playerStatus,result.error.message,true);
          else message(playerStatus,(p.suspended?'Player reactivated.':'Player suspended.'));
          await loadPlayers();
        });
        const right=make('div','flex items-center gap-3');right.append(status,button);row.append(right);playerList.append(row);
      });
      message(playerStatus,rows.length+' player'+(rows.length===1?'':'s')+' shown.');
    }
    playerSearch.addEventListener('input',renderPlayers);
    await loadPlayers();

    const moderation=section('Comment moderation','Review recent discussions and remove comments or replies that violate the platform rules.');
    const commentSearch=make('input','mt-4 w-full max-w-lg rounded-xl border border-slate-300 p-3');
    commentSearch.type='search';commentSearch.placeholder='Search comment, player or game…';commentSearch.setAttribute('aria-label','Search comments');
    const commentStatus=make('p','mt-3 text-sm');
    const commentList=make('div','mt-4 space-y-3');
    moderation.append(commentSearch,commentStatus,commentList);main.append(moderation);
    let commentRows=[];
    async function loadComments(){
      message(commentStatus,'Loading comments…');
      const result=await supabase.from('comments').select('id,body,game_id,user_id,parent_id,created_at,profiles(username),games(title)').order('created_at',{ascending:false}).limit(150);
      if(result.error){message(commentStatus,result.error.message,true);return}
      commentRows=result.data||[];renderComments();
    }
    function renderComments(){
      const term=commentSearch.value.trim().toLowerCase();
      const rows=commentRows.filter(c=>([c.body,c.profiles?.username,c.games?.title].filter(Boolean).join(' ')).toLowerCase().includes(term));
      commentList.replaceChildren();
      if(!rows.length)commentList.append(make('p','text-sm text-slate-500','No matching comments.'));
      rows.forEach(c=>{
        const card=make('article','rounded-xl border border-slate-200 p-4');
        const header=make('div','flex flex-wrap items-center justify-between gap-2');
        header.append(make('p','text-sm font-semibold',(c.profiles?.username||'Player')+' · '+(c.games?.title||c.game_id)));
        header.append(make('p','text-xs text-slate-500',new Date(c.created_at).toLocaleString()));
        card.append(header);
        card.append(make('p','mt-3 whitespace-pre-wrap break-words text-sm',c.body));
        if(c.parent_id)card.append(make('p','mt-2 text-xs text-slate-500','Reply'));
        const del=make('button','mt-3 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700','Delete comment');
        del.type='button';del.addEventListener('click',async()=>{
          if(!confirm('Delete this comment and any replies attached to it?'))return;
          del.disabled=true;
          const result=await supabase.from('comments').delete().eq('id',c.id);
          if(result.error)message(commentStatus,result.error.message,true);
          else message(commentStatus,'Comment deleted.');
          await loadComments();
        });
        card.append(del);commentList.append(card);
      });
      message(commentStatus,rows.length+' comment'+(rows.length===1?'':'s')+' shown.');
    }
    commentSearch.addEventListener('input',renderComments);
    await loadComments();

    async function refreshStats(){
      const queries=[
        ['Published games',supabase.from('games').select('id',{count:'exact',head:true}).eq('published',true)],
        ['Unpublished games',supabase.from('games').select('id',{count:'exact',head:true}).eq('published',false)],
        ['Game plays',supabase.from('play_history').select('game_id',{count:'exact',head:true})],
        ['Comments',supabase.from('comments').select('id',{count:'exact',head:true})],
        ['Game likes',supabase.from('likes').select('game_id',{count:'exact',head:true})],
        ['Comment likes',supabase.from('comment_likes').select('comment_id',{count:'exact',head:true})],
        ['Players',supabase.from('profiles').select('id',{count:'exact',head:true})]
      ];
      const results=await Promise.all(queries.map(async([name,q])=>({name,...await q})));
      const errors=results.filter(x=>x.error);
      results.forEach(x=>{statNodes[x.name].textContent=x.error?'—':(x.count||0).toLocaleString()});
      message(statsStatus,errors.length?'Some counts could not be loaded. Check database permissions.':'Statistics refreshed.');
    }
    await refreshStats();
    const refreshButton=make('button','mt-4 rounded-full border px-4 py-2 text-sm font-semibold','Refresh statistics');
    refreshButton.type='button';refreshButton.addEventListener('click',refreshStats);stats.append(refreshButton);
  }
}