async function loadUsers() {
  const { data, error } = await sb.from('profiles')
    .select('id,full_name,role,department,roll_no,cgpa,is_active,validated,approval_status,approval_note,profile_picture_url,created_at')
    .order('created_at', { ascending: false });

  const box = document.getElementById('userList');
  if (error) {
    box.innerHTML = `<div class="empty">Unable to load users: ${esc(error.message)}</div>`;
    return;
  }

  box.innerHTML = (data || []).map(u => {const pending=(u.approval_status==='pending'||u.approval_status==='rejected'||u.is_active===false||u.validated===false)&&u.role!=='admin';const status=u.approval_status==='pending'?'Pending approval':u.approval_status==='rejected'?'Rejected':u.is_active===false?'Inactive':'Approved';return `<div class="row user-row"><span class="identity-row">${u.profile_picture_url?`<img class="mini-avatar" src="${esc(u.profile_picture_url)}" alt="">`:''}<span><b>${esc(u.full_name || 'User')}</b><br><small>${esc(u.role)}${u.department ? ` · ${esc(u.department)}` : ''}${u.roll_no ? ` · Roll ${esc(u.roll_no)}` : ''} · ${status}</small></span></span><span class="button-wrap">${pending?`<button class="outline-btn" onclick="adminApproveUser('${u.id}','${u.role}')">Approve</button><button class="danger" onclick="adminRejectUser('${u.id}')">Reject</button>`:''}${u.role!=='admin'?`<button class="danger" onclick="adminToggleUser('${u.id}',${u.is_active!==false})">${u.is_active===false?'Reactivate':'Deactivate'}</button>`:''}</span></div>`;}).join('') || '<div class="empty">No users found.</div>';
}

async function createPortalUser() {
  const get = id => document.getElementById(id);
  const full_name = get('newFullName').value.trim();
  const email = get('newUserEmail').value.trim();
  const password = get('newUserPassword').value;
  const role = get('newUserRole').value;
  const department = get('newDepartment').value.trim();
  const roll_no = get('newRollNo').value.trim();
  const cgpa = get('newCgpa').value;
  const msg = get('userMsg');
  const btn = get('createUserBtn');

  if (!full_name || !email || !password) {
    msg.textContent = 'Please enter name, email and password.';
    msg.className = 'error';
    return;
  }
  if (password.length < 8) {
    msg.textContent = 'Password must contain at least 8 characters.';
    msg.className = 'error';
    return;
  }

  btn.disabled = true;
  msg.textContent = 'Creating account…';
  msg.className = 'muted';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Your admin session has expired. Please sign in again.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          full_name, email, password, role,
          department: department || null,
          roll_no: roll_no || null,
          cgpa: cgpa ? Number(cgpa) : null
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { error: raw || 'No response body.' }; }

    if (!response.ok) {
      const reason = payload?.error || payload?.message || `Edge Function HTTP ${response.status}`;
      throw new Error(reason);
    }

    if (payload?.error) throw new Error(payload.error);

    msg.textContent = '✓ Account created successfully.';
    msg.className = 'success';
    ['newFullName','newUserEmail','newUserPassword','newDepartment','newRollNo','newCgpa'].forEach(id => { get(id).value = ''; });
    get('newUserRole').value = 'student';
    await loadUsers();
  } catch (err) {
    const message = err?.name === 'AbortError'
      ? 'Account creation timed out. Make sure the admin-create-user Edge Function is deployed and its SUPABASE_SERVICE_ROLE_KEY secret is configured.'
      : (err?.message || 'Unable to create account.');
    msg.textContent = message;
    msg.className = 'error';
  } finally {
    btn.disabled = false;
  }
}

async function adminApproveUser(id,role){const {error}=await sb.from('profiles').update({validated:true,is_active:true,approval_status:'approved',approved_at:new Date().toISOString(),approved_by:(await sb.auth.getUser()).data.user.id,approval_note:null}).eq('id',id);if(error)return alert(error.message);if(role==='company'){const {error:ce}=await sb.from('companies').update({verified:true,approved_at:new Date().toISOString(),approved_by:(await sb.auth.getUser()).data.user.id,approval_note:null}).eq('user_id',id);if(ce)alert(ce.message);}await loadUsers();}
async function adminRejectUser(id){const reason=prompt('Reason for rejection:')||'';const uid=(await sb.auth.getUser()).data.user.id;const {data:u,error}=await sb.from('profiles').select('role').eq('id',id).single();if(error)return alert(error.message);const {error:pe}=await sb.from('profiles').update({validated:false,is_active:false,approval_status:'rejected',approval_note:reason,approved_at:new Date().toISOString(),approved_by:uid}).eq('id',id);if(pe)return alert(pe.message);if(u?.role==='company')await sb.from('companies').update({verified:false,approval_note:reason,approved_at:new Date().toISOString(),approved_by:uid}).eq('user_id',id);await loadUsers();}
async function adminToggleUser(id,active){if(!confirm(active?'Deactivate this user?':'Reactivate this user?'))return;const {error}=await sb.from('profiles').update({is_active:!active}).eq('id',id);if(error)alert(error.message);await loadUsers();}
