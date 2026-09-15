const API=(import.meta.env.VITE_API_URL||'https://kare-one-api.onrender.com/api').replace(/\/$/,'');

function installFastLogin(){
  const form=document.querySelector('.sis-login form');
  if(!form||form.dataset.fastLoginInstalled==='1')return !!form;
  form.dataset.fastLoginInstalled='1';
  const button=form.querySelector('button.primary');
  const identityInput=form.querySelector('input:not([type="password"]):not([type="checkbox"])');
  const passwordInput=form.querySelector('input[type="password"]');
  const footer=document.querySelector('.login-foot');
  if(footer)footer.textContent='KARE-SIS • Fast sign-in • Location is requested only when attendance is marked';

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    const identity=identityInput?.value?.trim()||'';
    const password=passwordInput?.value||'';
    if(!identity||!password)return;
    if(button){button.disabled=true;button.textContent='SIGNING IN…';}
    let errorBox=form.querySelector('.error');
    if(!errorBox){errorBox=document.createElement('div');errorBox.className='error';form.insertBefore(errorBox,button);}
    errorBox.textContent='';
    try{
      const deviceId=localStorage.getItem('kare_device_id')||crypto.randomUUID();
      localStorage.setItem('kare_device_id',deviceId);
      const response=await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:identity,password,deviceId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Invalid register number/email or password');
      localStorage.setItem('kare_token',data.token);
      localStorage.setItem('kare_user',JSON.stringify(data.user));
      window.location.reload();
    }catch(error){
      errorBox.textContent=error.message||'Login failed. Please try again.';
      if(button){button.disabled=false;button.textContent='SIGN IN';}
    }
  },true);
  return true;
}

const timer=setInterval(()=>{if(installFastLogin())clearInterval(timer)},50);
setTimeout(()=>clearInterval(timer),15000);
