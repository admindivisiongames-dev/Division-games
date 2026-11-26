import {supabase} from './client.js';

let mode='login';
let redirecting=false;
const $=s=>document.querySelector(s);
const form=$('#form');
const submit=$('.auth-submit');
const googleButton=$('#google-auth');
const resendButton=$('#resend-verification');
const message=$('#message');
const redirectUrl='https://division-games-eight.vercel.app/auth.html';

function setMessage(text,kind='info'){
  message.textContent=text;
  message.dataset.kind=kind;
}
function setBusy(busy){
  submit.disabled=busy;
  googleButton.disabled=busy;
  resendButton.disabled=busy;
  $('#submit-label').textContent=busy
    ?(mode==='signup'?'Creating account…':'Logging in…')
    :(mode==='signup'?'Create account':'Log in');
}
function friendlyError(error){
  const text=String(error?.message||error||'Something went wrong.');
  if(/invalid login credentials/i.test(text))return 'Email or password is incorrect.';
  if(/email not confirmed/i.test(text))return 'Please verify your email first. Check your inbox or resend the confirmation.';
  if(/user already registered/i.test(text))return 'This email already has an account. Log in instead.';
  if(/password should be at least/i.test(text))return 'Use a password with at least 6 characters.';
  if(/rate limit|email.*limit|too many requests/i.test(text))return 'Email sending is temporarily limited. Please wait a while before trying again.';
  if(/provider is not enabled|unsupported provider/i.test(text))return 'Google sign-in is not enabled in Supabase yet. Please use email login for now.';
  return text;
}
async function routeSession(session){
  if(!session?.user||redirecting)return;
  redirecting=true;
  setMessage('Signed in. Opening your Division account…');
  try{
    const {data,error}=await supabase.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
    if(error)throw error;
    const next=new URLSearchParams(location.search).get('next');
    const destination=(next==='admin'||data?.role==='admin')?'admin.html':next==='settings'?'settings.html':'profile.html';
    location.replace(destination);
  }catch(error){
    redirecting=false;
    setMessage('Signed in, but your profile could not be loaded: '+friendlyError(error),'error');
  }
}

supabase.auth.onAuthStateChange((event,session)=>{
  if((event==='SIGNED_IN'||event==='INITIAL_SESSION')&&session)routeSession(session);
});

function setMode(next){
  mode=next;
  const signup=mode==='signup';
  $('#unlabel').hidden=!signup;
  $('#username').required=signup;
  $('#username').autocomplete='nickname';
  $('#password').autocomplete=signup?'new-password':'current-password';
  $('#login').classList.toggle('active',!signup);
  $('#signup').classList.toggle('active',signup);
  $('#login').setAttribute('aria-selected',String(!signup));
  $('#signup').setAttribute('aria-selected',String(signup));
  $('#auth-heading').textContent=signup?'Create your account.':'Welcome back.';
  $('#auth-subtitle').textContent=signup
    ?'Join Division and keep your favourite games in one place.'
    :'Log in to pick up where you left off.';
  $('#submit-label').textContent=signup?'Create account':'Log in';
  resendButton.hidden=true;
  setMessage('');
}
$('#login').addEventListener('click',()=>setMode('login'));
$('#signup').addEventListener('click',()=>setMode('signup'));

form.addEventListener('submit',async event=>{
  event.preventDefault();
  const email=$('#email').value.trim().toLowerCase();
  const password=$('#password').value;
  const username=$('#username').value.trim();
  if(mode==='signup'&&!username){setMessage('Please choose a username.','error');return}
  setBusy(true);
  resendButton.hidden=true;
  setMessage('');
  try{
    if(mode==='signup'){
      const {data,error}=await supabase.auth.signUp({
        email,password,
        options:{data:{username},emailRedirectTo:redirectUrl}
      });
      if(error)throw error;
      if(data.session){await routeSession(data.session)}
      else{
        setMessage('Account created. Check your inbox and spam folder for the verification link.');
        resendButton.hidden=false;
        resendButton.dataset.email=email;
      }
    }else{
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw error;
      await routeSession(data.session);
    }
  }catch(error){
    setMessage(friendlyError(error),'error');
  }finally{setBusy(false)}
});

googleButton.addEventListener('click',async()=>{
  setBusy(true);
  setMessage('Connecting to Google…');
  try{
    const redirectTo=redirectUrl+location.search;
    const {error}=await supabase.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo,queryParams:{prompt:'select_account'}}
    });
    if(error)throw error;
  }catch(error){
    setMessage(friendlyError(error),'error');
    setBusy(false);
  }
});

resendButton.addEventListener('click',async()=>{
  const email=resendButton.dataset.email||$('#email').value.trim().toLowerCase();
  if(!email){setMessage('Enter your email address first.','error');return}
  resendButton.disabled=true;
  setMessage('Requesting another verification email…');
  try{
    const {error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:redirectUrl}});
    if(error)throw error;
    setMessage('Verification email requested. Check your inbox and spam folder.');
  }catch(error){setMessage(friendlyError(error),'error')}
  finally{resendButton.disabled=false}
});

const oauthError=new URLSearchParams(location.search).get('error_description');
if(oauthError)setMessage(decodeURIComponent(oauthError.replace(/\+/g,' ')),'error');
