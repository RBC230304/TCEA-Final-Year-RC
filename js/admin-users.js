async function loadUsers(){
  const {data, error}=await sb.from('profiles').select('id,full_name,role,department,roll_no,cgpa,created_at').order('created_at',{ascending:false});
  if(error){document.getElementById('userList').innerHTML='<div class="empty">Unable to load users: '+esc(error.message)+'</div>';return;}
  const rows=(data||[]).map(u=>`<div class="row user-row"><span><b>${esc(u.full_name||'User')}</b><br><small>${esc(u.role)}${u.department?' · '+esc(u.department):''}${u.roll_no?' · Roll '+esc(u.roll_no):''}</small></span><span class="user-meta">${u.cgpa!=null?'CGPA '+esc(String(u.cgpa)):''}</span></div>`).join('');
  document.getElementById('userList').innerHTML=rows||'<div class="empty">No users found.</div>';
}

async function createPortalUser(){
  const full_name=document.getElementById('newFullName').value.trim();
  const email=document.getElementById('newUserEmail').value.trim();
  const password=document.getElementById('newUserPassword').value;
  const role=document.getElementById('newUserRole').value;
  const department=document.getElementById('newDepartment').value.trim();
  const roll_no=document.getElementById('newRollNo').value.trim();
  const cgpa=document.getElementById('newCgpa').value;
  const msg=document.getElementById('userMsg');
  const btn=document.getElementById('createUserBtn');
  if(!full_name||!email||!password){msg.textContent='Please enter name, email and password.';msg.className='error';return;}
  if(password.length<8){msg.textContent='Password must contain at least 8 characters.';msg.className='error';return;}
  btn.disabled=true; msg.textContent='Creating account...'; msg.className='muted';
  const {data,error}=await sb.functions.invoke('admin-create-user',{body:{full_name,email,password,role,department,roll_no,cgpa:cgpa?Number(cgpa):null}});
  if(error){msg.textContent=error.message||'Unable to create account.';msg.className='error';btn.disabled=false;return;}
  if(data?.error){msg.textContent=data.error;msg.className='error';btn.disabled=false;return;}
  msg.textContent='✓ Account created successfully.';msg.className='success';
  ['newFullName','newUserEmail','newUserPassword','newDepartment','newRollNo','newCgpa'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('newUserRole').value='student';
  btn.disabled=false; loadUsers();
}
