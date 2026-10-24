const role = new URLSearchParams(location.search).get('role') || 'student';
const labels={
 student:['Student Login','Access jobs, applications, CVs, practice and notifications'],
 tpo:['TPO Login','Manage drives, approvals, students, companies and placement analytics'],
 admin:['TPO Login','Manage the portal securely'],
 coordinator:['Coordinator Login','Review applicants, shortlist students and download CVs when authorized'],
 company:['Company Login','Post jobs, manage CV formats, shortlist candidates and interviews']
};
const info=labels[role]||labels.student;
document.getElementById('title').textContent=info[0];
document.getElementById('subtitle').textContent=info[1];
const badge=document.getElementById('roleBadge'); if(badge) badge.textContent=(role||'student').toUpperCase()+' WORKSPACE';
if(role==='admin')document.getElementById('adminNote').style.display='none';
if(role==='tpo'||role==='admin'||role==='coordinator')document.getElementById('signupLinks').style.display='none';

const emailEl=document.getElementById('email'), passwordEl=document.getElementById('password');
document.getElementById('loginForm').onsubmit=async e=>{
  e.preventDefault(); const msg=document.getElementById('msg'),btn=e.submitter||document.querySelector('#loginForm button');
  msg.textContent='Signing in securely…'; msg.className='msg muted'; if(btn)btn.disabled=true;
  if(typeof SUPABASE_CONFIGURED !== 'undefined' && !SUPABASE_CONFIGURED){msg.textContent='Portal setup required: add your Supabase project URL and anon key in js/config.js before signing in.';msg.className='msg error';if(btn)btn.disabled=false;return;}
  try{
    const {data,error}=await sb.auth.signInWithPassword({email:emailEl.value.trim(),password:passwordEl.value});
    if(error) throw error;
    const {data:p,error:pe}=await sb.from('profiles').select('role,full_name,is_active,validated,approval_status').eq('id',data.user.id).single();
    if(pe||!p) throw new Error('Profile not found. Contact the TPO.');
    if(p.approval_status==='rejected'){await sb.auth.signOut();throw new Error('Your registration was rejected. Please contact the TPO/Admin for details.');}
    if(p.approval_status==='pending'||p.validated===false||p.is_active===false){
      await sb.auth.signOut();
      throw new Error('Your registration is pending TPO approval. Please try again after your account is approved.');
    }
    if(role==='admin' && !['admin','tpo'].includes(p.role)) throw new Error('This account does not have TPO access.');
    if(role!=='admin'&&p.role!==role) throw new Error('This account does not have '+role+' access.');
    location.href=['admin','tpo'].includes(p.role)?'tpo.html':p.role==='coordinator'?'coordinator.html':p.role==='company'?'company.html':'student.html';
  }catch(err){msg.textContent=err.message||'Unable to sign in.';msg.className='msg error';try{await sb.auth.signOut()}catch{}if(btn)btn.disabled=false;}
};
