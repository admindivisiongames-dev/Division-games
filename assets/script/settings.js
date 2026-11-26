import {supabase,user} from './client.js';
const $=s=>document.querySelector(s);
const controls={theme:$('#theme'),reduced_motion:$('#reduced-motion'),mute_games:$('#game-sound'),save_history:$('#save-history')};
const defaults={theme:'system',reduced_motion:false,mute_games:false,save_history:true};
let prefs={...defaults},saveTimer;
const status=$('#settings-status');
function say(text,error=false){status.textContent=text;status.style.color=error?'#b42338':'#007a65'}
function apply(){
  const dark=prefs.theme==='dark'||(prefs.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark',dark);
  document.documentElement.style.scrollBehavior=prefs.reduced_motion?'auto':'smooth';
  document.documentElement.dataset.reducedMotion=prefs.reduced_motion?'true':'false';
  document.documentElement.dataset.muteGames=prefs.mute_games?'true':'false';
}
function show(){controls.theme.value=prefs.theme;controls.reduced_motion.checked=!!prefs.reduced_motion;controls.mute_games.checked=!!prefs.mute_games;controls.save_history.checked=prefs.save_history!==false;apply()}
async function save(){
  const u=await user();if(!u)return;
  say('Saving preferences…');
  const {error}=await supabase.from('profiles').update({settings:prefs}).eq('id',u.id);
  if(error){say('Could not save: '+error.message,true);return}
  say('Settings saved to your account.');
}
function changed(key,value){prefs[key]=value;apply();clearTimeout(saveTimer);saveTimer=setTimeout(save,250)}
for(const [key,input] of Object.entries(controls)){input.addEventListener('change',()=>changed(key,input.type==='checkbox'?input.checked:input.value))}
const u=await user();
if(!u){location.replace('auth.html?next=settings');}
else{
  $('#settings-email').textContent=u.email||'Your Division account';
  const {data,error}=await supabase.from('profiles').select('settings').eq('id',u.id).maybeSingle();
  if(error)say('Could not load saved settings. Defaults are shown.',true);
  prefs={...defaults,...(data?.settings||{})};show();
  if(new URLSearchParams(location.search).get('saved')==='1')say('Account action completed.');
}
$('#sign-out').addEventListener('click',async()=>{const b=$('#sign-out');b.disabled=true;b.textContent='Signing out…';const {error}=await supabase.auth.signOut();if(error){say(error.message,true);b.disabled=false;b.textContent='Sign out'}else location.replace('index.html')});
