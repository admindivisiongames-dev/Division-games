import {supabase} from './client.js';

let mode='login';
const $=s=>document.querySelector(s);
const form=$('#form');
const submit=$('.auth-submit');
const message=$('#message');

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
  message.textContent='';
}
$('#login').addEventListener('click',()=>setMode('login'));
$('#signup').addEventListener('click',()=>setMode('signup'));

form.addEventListener('submit',async event=>{
  event.preventDefault();
  const email=$('#email').value.trim();
  const password=$('#password').value;
  const username=$('#username').value.trim();
  submit.disabled=true;
  $('#submit-label').textContent=mode==='signup'?'Creating account…':'Logging in…';
  message.textContent='';
  try{
    const result=mode==='signup'
      ?await supabase.auth.signUp({email,password,options:{data:{username},emailRedirectTo:`${window.location.origin}/auth.html`}})
      :await supabase.auth.signInWithPassword({email,password});
    if(result.error)throw result.error;
    if(mode==='signup'&&!result.data.session){
      message.textContent='Account created. Check your email to confirm, then log in.';
    }else if(result.data.session){
      message.textContent='You’re in! Taking you to your profile…';
      setTimeout(()=>location.href='profile.html',650);
    }else{
      message.textContent='Please check your email to continue.';
    }
  }catch(error){
    message.textContent=error.message||'Something went wrong. Please try again.';
  }finally{
    submit.disabled=false;
    $('#submit-label').textContent=mode==='signup'?'Create account':'Log in';
  }
});
