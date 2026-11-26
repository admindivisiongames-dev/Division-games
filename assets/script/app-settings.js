import {supabase,user} from './client.js';
const applyPrefs=p=>{
  const theme=p?.theme||'system';
  const dark=theme==='dark'||(theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark',dark);
  document.documentElement.classList.toggle('reduce-motion',!!p?.reduced_motion);
  document.documentElement.dataset.muteGames=p?.mute_games?'true':'false';
};
const u=await user().catch(()=>null);
if(u){
  const {data}=await supabase.from('profiles').select('settings').eq('id',u.id).maybeSingle();
  applyPrefs(data?.settings||{});
}else applyPrefs({});
