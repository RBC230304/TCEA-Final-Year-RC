const byId = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.panel').forEach(x => x.classList.add('hide'));
  byId(btn.dataset.tab)?.classList.remove('hide');
}));

async function guard() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return location.replace('login.html?role=admin');
  const { data: p, error } = await sb.from('profiles').select('role').eq('id', user.id).single();
  if (error || p?.role !== 'admin') return location.replace('index.html');
  await loadAll();
}

async function loadAll() {
  const { data: s } = await sb.from('site_settings').select('*').eq('id', 1).single();
  if (s) { byId('siteName').value = s.site_name || ''; byId('heroText').value = s.hero_text || ''; }
  const { data: st } = await sb.from('placement_stats').select('*').eq('id', 1).single();
  if (st) {
    byId('totalStudents').value = st.total_students ?? 0;
    byId('companies').value = st.companies ?? 0;
    byId('activeDrives').value = st.active_drives ?? 0;
    byId('studentsPlaced').value = st.students_placed ?? 0;
  }
  await Promise.all([renderJobs(), renderNotices(), loadUsers(), loadAdminHomeAds()]);
}

async function saveHome() {
  const { error } = await sb.from('site_settings').upsert({ id:1, site_name:byId('siteName').value.trim(), hero_text:byId('heroText').value.trim() });
  const msg = byId('homeMsg'); msg.textContent = error ? ` ${error.message}` : ' ✓ Saved'; msg.className = error ? 'error' : 'success';
}

async function saveStats() {
  const v = id => Number(byId(id).value || 0);
  const { error } = await sb.from('placement_stats').upsert({ id:1, total_students:v('totalStudents'), companies:v('companies'), active_drives:v('activeDrives'), students_placed:v('studentsPlaced') });
  alert(error ? error.message : 'Statistics saved.');
}

async function addJob() {
  const v = id => byId(id).value.trim();
  const { error } = await sb.from('jobs').insert({ title:v('jobTitle'), company:v('jobCompany'), location:v('jobLocation'), min_cgpa:Number(byId('jobCgpa').value || 0), description:v('jobDesc') });
  if (error) return alert(error.message);
  ['jobTitle','jobCompany','jobLocation','jobDesc','jobCgpa'].forEach(id => byId(id).value='');
  await renderJobs();
}

async function renderJobs() {
  const { data, error } = await sb.from('jobs').select('*').order('created_at', { ascending:false });
  const box = byId('jobList');
  if (error) return box.innerHTML = `<div class="error">${esc(error.message)}</div>`;
  box.innerHTML = (data||[]).map(j => `<div class="row"><span><b>${esc(j.title)}</b><br><small>${esc(j.company)} · ${esc(j.location||'')}</small></span><button class="danger" onclick="delJob('${j.id}')">Delete</button></div>`).join('') || '<div class="empty">No placement drives.</div>';
}
async function delJob(id){ if(!confirm('Delete this placement drive?')) return; const {error}=await sb.from('jobs').delete().eq('id',id); if(error) alert(error.message); await renderJobs(); }

async function addNotice(){ const title=byId('noticeTitle').value.trim(), body=byId('noticeBody').value.trim(); if(!title||!body)return alert('Enter notice title and message.'); const {error}=await sb.from('notices').insert({title,body}); if(error)alert(error.message);else{byId('noticeTitle').value='';byId('noticeBody').value='';await renderNotices();} }
async function renderNotices(){ const {data,error}=await sb.from('notices').select('*').order('created_at',{ascending:false}); const box=byId('noticeList'); if(error)return box.innerHTML=`<div class="error">${esc(error.message)}</div>`; box.innerHTML=(data||[]).map(n=>`<div class="row"><span><b>${esc(n.title)}</b><br><small>${esc(n.body)}</small></span><button class="danger" onclick="delNotice('${n.id}')">Delete</button></div>`).join('')||'<div class="empty">No notices.</div>'; }
async function delNotice(id){ if(!confirm('Delete this notice?'))return; const {error}=await sb.from('notices').delete().eq('id',id); if(error)alert(error.message); await renderNotices(); }

guard();

async function loadAdminHomeAds(){const box=byId('adminHomeAds');if(!box)return;const {data,error}=await sb.from('home_job_ads').select('*').order('created_at',{ascending:false});if(error){box.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}box.innerHTML=(data||[]).map(a=>`<div class="ad-review-card"><img src="${esc(a.poster_url)}" alt=""><div class="ad-review-copy"><div class="split-head"><div><span class="ad-status ${esc(a.status)}">${esc(a.status)}</span><h3>${esc(a.title)}</h3><b>${esc(a.company_name)}</b></div><small>${new Date(a.created_at).toLocaleString()}</small></div>${a.caption?`<p>${esc(a.caption)}</p>`:''}<div class="button-wrap">${a.status!=='approved'?`<button class="primary" onclick="adminApproveHomeAd('${a.id}')">Approve & Publish</button>`:''}${a.status!=='rejected'?`<button class="danger" onclick="adminRejectHomeAd('${a.id}')">Reject</button>`:''}${a.status==='approved'?`<button class="outline-btn" onclick="adminArchiveHomeAd('${a.id}')">Archive</button>`:''}<a class="outline-btn" target="_blank" rel="noopener" href="${esc(a.poster_url)}">View Poster</a></div></div></div>`).join('')||'<div class="empty">No job-ad posters submitted.</div>';}
async function adminApproveHomeAd(id){const uid=(await sb.auth.getUser()).data.user.id;const {error}=await sb.from('home_job_ads').update({status:'approved',active:true,approved_by:uid,approved_at:new Date().toISOString(),rejection_reason:null}).eq('id',id);if(error)alert(error.message);await loadAdminHomeAds();}
async function adminRejectHomeAd(id){const reason=prompt('Reason for rejection:')||'Not approved by Administrator.';const uid=(await sb.auth.getUser()).data.user.id;const {error}=await sb.from('home_job_ads').update({status:'rejected',active:false,approved_by:uid,approved_at:new Date().toISOString(),rejection_reason:reason}).eq('id',id);if(error)alert(error.message);await loadAdminHomeAds();}
async function adminArchiveHomeAd(id){const {error}=await sb.from('home_job_ads').update({status:'archived',active:false}).eq('id',id);if(error)alert(error.message);await loadAdminHomeAds();}
