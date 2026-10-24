const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const el = id => document.getElementById(id);

let tpoUser = null;

for (const btn of document.querySelectorAll('.tab')) btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.panel').forEach(x => x.classList.add('hide'));
  el(btn.dataset.tab)?.classList.remove('hide');
  if (btn.dataset.tab === 'tpo-alerts') { loadAlertOptions(); }
  if (btn.dataset.tab === 'tpo-messages') { loadMessageRecipients(); loadMessages(); }
  if (btn.dataset.tab === 'tpo-home-ads') { loadHomeAds(); }
});

async function guard() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return location.replace('login.html?role=tpo');
  const { data: p, error } = await sb.from('profiles').select('id,role,full_name,email,is_active').eq('id', user.id).single();
  if (error || !['tpo','admin'].includes(p?.role)) return location.replace('index.html');
  if (p.is_active === false) return location.replace('index.html');
  tpoUser = p;
  await loadAll();
}

async function loadAll() {
  await Promise.all([loadStats(), loadStudents(), loadCompanies(), loadDrives(), loadInterviews(), loadHistory(), loadMessages(), loadAlertOptions(), loadMessageRecipients(), loadHomeAds()]);
}

async function loadStats() {
  const [{ data: students }, { data: companies }, { data: jobs }, { data: apps }, { data: hist }] = await Promise.all([
    sb.from('profiles').select('id,department,validated').eq('role','student'),
    sb.from('companies').select('id,name,user_id'),
    sb.from('jobs').select('id,company,active'),
    sb.from('applications').select('id,student_id,job_id,status'),
    sb.from('placement_history').select('average_package,highest_package')
  ]);
  const selected = (apps || []).filter(x => x.status === 'Selected');
  el('a').textContent = students?.length || 0;
  el('regStudents').textContent = (students || []).filter(x => x.validated !== false).length;
  el('b').textContent = companies?.length || 0;
  el('c').textContent = (jobs || []).filter(x => x.active).length;
  el('d').textContent = selected.length;
  el('placementPct').textContent = `${students?.length ? Math.round(selected.length / students.length * 100) : 0}%`;
  const av = (hist || []).length ? (hist || []).reduce((s,x) => s + Number(x.average_package || 0), 0) / hist.length : 0;
  const hi = Math.max(0, ...(hist || []).map(x => Number(x.highest_package || 0)));
  el('avgPackage').textContent = `₹${Math.round(av)}`;
  el('highPackage').textContent = `₹${Math.round(hi)}`;

  const dep = {};
  for (const a of selected) { const st = (students || []).find(s => s.id === a.student_id); const k = st?.department || 'Unknown'; dep[k] = (dep[k] || 0) + 1; }
  el('deptStats').innerHTML = Object.entries(dep).map(([k,v]) => `<p><b>${esc(k)}</b>: ${v}</p>`).join('') || 'No department data.';
  const comp = {};
  for (const a of selected) { const j = (jobs || []).find(x => x.id === a.job_id); const k = j?.company || 'Company'; comp[k] = (comp[k] || 0) + 1; }
  el('companyStats').innerHTML = Object.entries(comp).map(([k,v]) => `<p><b>${esc(k)}</b>: ${v}</p>`).join('') || 'No selection data.';
}

async function loadStudents() {
  const { data, error } = await sb.from('profiles').select('*').eq('role','student').order('created_at',{ascending:false});
  if (error) return el('studentList').innerHTML = `<div class="error">${esc(error.message)}</div>`;
  el('studentList').innerHTML = (data || []).map(s => { const pending=['pending','rejected'].includes(s.approval_status)||s.validated===false||s.is_active===false; return `<div class="row">
    <span class="identity-row">${s.profile_picture_url?`<img class="mini-avatar" src="${esc(s.profile_picture_url)}" alt="">`:''}<span><b>${esc(s.full_name || 'Student')}</b><br><small>${esc(s.email||'')} · ${esc(s.department||'')} · Roll ${esc(s.roll_no||'')} · CGPA ${s.cgpa ?? '—'} · ${s.approval_status==='pending'?'Pending approval':s.approval_status==='rejected'?'Rejected':s.validated===false?'Pending validation':'Approved'} · ${s.is_active===false?'Inactive':'Active'}</small></span></span>
    <span class="button-wrap">${pending?`<button class="outline-btn" onclick="approveStudent('${s.id}')">Approve</button><button class="danger" onclick="rejectStudent('${s.id}')">Reject</button>`:''}<button class="outline-btn" onclick="toggleValidation('${s.id}',${s.validated!==false})">${s.validated===false?'Validate':'Unvalidate'}</button><button class="danger" onclick="toggleActive('${s.id}',${s.is_active!==false})">${s.is_active===false?'Reactivate':'Deactivate'}</button></span>
  </div>`; }).join('') || '<div class="empty">No students.</div>';
}
async function toggleValidation(id, v){ const {error}=await sb.from('profiles').update({validated:!v}).eq('id',id); if(error)alert(error.message); await loadStudents(); }
async function approveStudent(id){const {error}=await sb.from('profiles').update({validated:true,is_active:true,approval_status:'approved',approved_at:new Date().toISOString(),approved_by:tpoUser.id,approval_note:null}).eq('id',id);if(error)return alert(error.message);await loadStudents();await loadStats();}
async function rejectStudent(id){const note=prompt('Reason for rejection (optional):')||'';const {error}=await sb.from('profiles').update({validated:false,is_active:false,approval_status:'rejected',approval_note:note,approved_at:new Date().toISOString(),approved_by:tpoUser.id}).eq('id',id);if(error)return alert(error.message);await loadStudents();}
async function toggleActive(id, v){ if(!confirm(v?'Deactivate this student account?':'Reactivate this student account?'))return; const {error}=await sb.from('profiles').update({is_active:!v}).eq('id',id); if(error)alert(error.message); await loadStudents(); }
async function saveStudent(){ const email=el('newStudentEmail').value.trim(); if(!email)return el('studentMsg').textContent='Enter an existing student email.'; const patch={full_name:el('newStudentName').value.trim(),department:el('newStudentDept').value.trim(),roll_no:el('newStudentRoll').value.trim(),cgpa:el('newStudentCgpa').value?Number(el('newStudentCgpa').value):null,validated:el('studentValidation').value==='true'}; const {error}=await sb.from('profiles').update(patch).eq('email',email).eq('role','student'); const m=el('studentMsg');m.textContent=error?error.message:' ✓ Student updated';m.className=error?'error':'success';await loadStudents(); }

async function loadCompanies(){
  const {data,error}=await sb.from('companies').select('*').order('created_at',{ascending:false});
  if(error)return el('companyList').innerHTML=`<div class="error">${esc(error.message)}</div>`;
  const ids=(data||[]).map(c=>c.user_id).filter(Boolean);
  const {data:profiles}=ids.length?await sb.from('profiles').select('id,full_name,email,is_active,approval_status').in('id',ids):{data:[]};
  el('companyList').innerHTML=(data||[]).map(c=>{const p=(profiles||[]).find(x=>x.id===c.user_id)||{};const pending=['pending','rejected'].includes(p.approval_status)||p.is_active===false||c.verified===false;return `<div class="row"><span class="identity-row">${c.logo_url?`<img class="mini-avatar" src="${esc(c.logo_url)}" alt="">`:''}<span><b>${esc(c.name||p.full_name||'Company')}</b><br><small>${esc(c.email||p.email||'')} · ${esc(c.phone||'')} · ${p.approval_status==='pending'?'Pending approval':p.approval_status==='rejected'?'Rejected':c.verified?'Verified':'Pending verification'} · ${p.is_active===false?'Inactive':'Active'}</small></span></span><span class="button-wrap">${pending?`<button class="outline-btn" onclick="approveCompany('${c.id}','${c.user_id}')">Approve</button><button class="danger" onclick="rejectCompany('${c.id}','${c.user_id}')">Reject</button>`:''}<button class="outline-btn" onclick="verifyCompany('${c.id}',${!!c.verified})">${c.verified?'Unverify':'Verify'}</button><button class="danger" onclick="toggleCompanyAccess('${c.user_id}',${p.is_active!==false})">${p.is_active===false?'Reactivate':'Deactivate'}</button></span></div>`}).join('')||'<div class="empty">No companies.</div>';
}
async function verifyCompany(id,v){const {error}=await sb.from('companies').update({verified:!v}).eq('id',id);if(error)alert(error.message);await loadCompanies();}
async function approveCompany(id,userId){const {error:pe}=await sb.from('profiles').update({validated:true,is_active:true,approval_status:'approved',approved_at:new Date().toISOString(),approved_by:tpoUser.id,approval_note:null}).eq('id',userId);if(pe)return alert(pe.message);const {error:ce}=await sb.from('companies').update({verified:true,approved_at:new Date().toISOString(),approved_by:tpoUser.id,approval_note:null}).eq('id',id);if(ce)return alert(ce.message);await loadCompanies();await loadStats();}
async function rejectCompany(id,userId){const note=prompt('Reason for rejection (optional):')||'';const {error:pe}=await sb.from('profiles').update({validated:false,is_active:false,approval_status:'rejected',approval_note:note,approved_at:new Date().toISOString(),approved_by:tpoUser.id}).eq('id',userId);if(pe)return alert(pe.message);const {error:ce}=await sb.from('companies').update({verified:false,approval_note:note,approved_at:new Date().toISOString(),approved_by:tpoUser.id}).eq('id',id);if(ce)return alert(ce.message);await loadCompanies();}
async function toggleCompanyAccess(userId,v){if(!userId)return;if(!confirm(v?'Deactivate this company account?':'Reactivate this company account?'))return;const {error}=await sb.from('profiles').update({is_active:!v}).eq('id',userId);if(error)alert(error.message);await loadCompanies();}

async function loadDrives(){
  const {data,error}=await sb.from('jobs').select('*').order('created_at',{ascending:false});
  if(error)return el('driveList').innerHTML=`<div class="error">${esc(error.message)}</div>`;
  const jobs=data||[];
  el('driveList').innerHTML=jobs.map(j=>`<div class="drive-card"><div class="row" style="align-items:flex-start"><span><b>${esc(j.title)}</b> · ${esc(j.company)}<br><small>${esc(j.location||'')} · Skills: ${esc((j.required_skills||[]).join(', '))} · ${j.active?'Active':'Closed'} · CV: ${esc(j.cv_template_name||j.cv_template_type||'Web Professional')}</small></span><span class="button-wrap"><input id="tpoTpl_${j.id}" type="file" accept="application/pdf" hidden onchange="uploadTpoTemplate('${j.id}',this)"><button class="outline-btn" onclick="document.getElementById('tpoTpl_${j.id}').click()">${j.cv_template_url?'Replace PDF Format':'Upload PDF Format'}</button><button class="outline-btn" onclick="tpoOpenCVBuilder('${j.id}')">Build CV on Website</button><button class="outline-btn" onclick="tpoEditCVRequirements('${j.id}')">CV Fields</button><button class="outline-btn" onclick="openTpoCandidates('${j.id}')">Shortlist Students</button><button class="outline-btn" onclick="downloadShortlistedCVs('${j.id}')">Download Shortlisted CVs</button><button class="outline-btn" onclick="toggleDrive('${j.id}',${!!j.active})">${j.active?'Close':'Reopen'}</button></span></div><div id="tpoCand_${j.id}" class="box hide nested-box"></div></div>`).join('')||'<div class="empty">No drives.</div>';
}

async function validatePdfFile(file){
  try{const doc=await PDFLib.PDFDocument.load(await file.arrayBuffer());const fields=doc.getForm().getFields();return fields.length;}catch{return 0;}
}
async function tpoEditCVRequirements(jobId){
  const {data:job,error}=await sb.from('jobs').select('*').eq('id',jobId).single();if(error)return alert(error.message);
  const wrap=document.createElement('div');wrap.className='cv-modal-backdrop';wrap.innerHTML=`<div class="cv-modal"><div class="cv-modal-head"><div><div class="kicker">TPO CV requirements</div><h3>${esc(job?.title||'Placement drive')}</h3><p class="muted">Specify the exact information students must provide for this drive.</p></div><button class="secondary" type="button">Close</button></div><div class="cv-requirements-builder" data-cv-builder-fields="tpo-modal"></div><div class="cv-actions"><button class="primary" type="button" id="saveTpoFields">Save requirements</button></div></div>`;document.body.appendChild(wrap);renderCVFieldBuilder('tpo-modal',job?.cv_required_fields||[]);wrap.querySelector('.cv-modal-head .secondary').onclick=()=>wrap.remove();wrap.querySelector('#saveTpoFields').onclick=async()=>{const fields=collectCVFieldBuilder('tpo-modal');const {error:ue}=await sb.from('jobs').update({cv_required_fields:fields}).eq('id',jobId);if(ue)return alert(ue.message);alert('CV requirements saved.');wrap.remove();await loadDrives();};
}
async function uploadTpoTemplate(jobId,input){
  const file=input.files?.[0]; if(!file)return;
  if(file.type!=='application/pdf'){alert('Please upload a PDF CV format.');input.value='';return;}
  const fieldCount=await validatePdfFile(file); if(!fieldCount){alert('This PDF is not a fillable form. Please upload a fillable PDF with named text fields.');input.value='';return;}
  const safe=`tpo/${jobId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const up=await sb.storage.from('cv-templates').upload(safe,file,{contentType:'application/pdf',upsert:true});
  if(up.error){alert('Template upload failed: '+up.error.message);return;}
  const url=sb.storage.from('cv-templates').getPublicUrl(safe).data.publicUrl;
  const {error}=await sb.from('jobs').update({cv_template_type:'pdf',cv_template_url:url,cv_template_name:file.name,cv_template:'PDF fillable template'}).eq('id',jobId);
  if(error)alert(error.message);else alert(`Fillable PDF saved. ${fieldCount} form field(s) detected.`);
  await loadDrives();
}

async function openTpoCandidates(jobId){
  const box=el('tpoCand_'+jobId); if(!box)return;
  if(!box.classList.contains('hide')){box.classList.add('hide');return}
  box.classList.remove('hide'); box.innerHTML='<p class="muted">Loading candidates…</p>';
  const [{data:apps,error},{data:job,jError}]=await Promise.all([
    sb.from('applications').select('*').eq('job_id',jobId).order('applied_at',{ascending:true}),
    sb.from('jobs').select('*').eq('id',jobId).single()
  ]);
  if(error){box.innerHTML=`<div class="error">${esc(error.message)}</div>`;return}
  const ids=[...new Set((apps||[]).map(a=>a.student_id))]; const {data:profiles}=ids.length?await sb.from('profiles').select('*').in('id',ids):{data:[]};
  if(!apps?.length){box.innerHTML='<div class="empty">No applicants for this job.</div>';return;}
  const j=job||{};
  box.innerHTML=`<div class="kicker">Candidate shortlist · ${esc(j.title||'')}</div><div class="candidate-toolbar"><button class="outline-btn" onclick="shortlistAllRecommended('${jobId}')">Shortlist recommended (60%+)</button><button class="outline-btn" onclick="setAllJobStatus('${jobId}','Shortlisted')">Shortlist all</button><button class="danger" onclick="setAllJobStatus('${jobId}','Rejected')">Reject all</button></div>`+
    (apps||[]).map(a=>{const p=(profiles||[]).find(x=>x.id===a.student_id)||{};const m=smartMatch(p,j);return `<div class="row" style="align-items:flex-start"><span><b>${esc(p.full_name||'Student')}</b><br><small>${esc(p.department||'')} · Roll ${esc(p.roll_no||'')} · CGPA ${p.cgpa??'—'} · ${esc(p.email||'')} · Match <b>${m.score}%</b>${m.missing.length?' · Missing: '+esc(m.missing.join(', ')):''}</small><br><small>Current status: <b>${esc(a.status)}</b></small></span><span><select onchange="tpoSetStatus('${a.id}',this.value,'${a.student_id}')"><option ${a.status==='Applied'?'selected':''}>Applied</option><option ${a.status==='Shortlisted'?'selected':''}>Shortlisted</option><option ${a.status==='Selected'?'selected':''}>Selected</option><option ${a.status==='Rejected'?'selected':''}>Rejected</option></select><button class="outline-btn" onclick="scheduleInterview('${a.id}','${a.job_id}','${a.student_id}')">Interview</button><button class="outline-btn" onclick="emailCompanyForJob('${a.job_id}')">Contact Company</button></span></div>`}).join('');
}
function smartMatch(profile,job){
  const cv=[...(profile.skills||[]),...(profile.certifications||[]),...(profile.projects||[]),profile.resume_text||'',profile.resume_name||''].join(' ').toLowerCase();
  const skills=(job.required_skills||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean);
  const hit=skills.filter(s=>cv.includes(s));
  let score=skills.length?hit.length/skills.length*70:50;
  if(profile.cgpa!=null&&job.min_cgpa!=null&&Number(profile.cgpa)>=Number(job.min_cgpa))score+=20;
  if(job.location&&profile.preferred_location&&job.location.toLowerCase().includes(profile.preferred_location.toLowerCase()))score+=10;
  return {score:Math.min(100,Math.round(score)),missing:skills.filter(s=>!hit.includes(s))};
}
async function tpoSetStatus(id,status,studentId){const {error}=await sb.from('applications').update({status}).eq('id',id);if(error)return alert(error.message);const {error:ne}=await sb.from('notifications').insert({student_id:studentId,title:`Application ${status}`,body:`Your application status has been updated to ${status}.`,type:'Recruitment'});if(ne)console.warn(ne.message);}
async function setAllJobStatus(jobId,status){const {data:apps,error}=await sb.from('applications').select('id,student_id').eq('job_id',jobId);if(error)return alert(error.message);if(!apps?.length)return alert('No applicants found.');const {error:upErr}=await sb.from('applications').update({status}).eq('job_id',jobId);if(upErr)return alert(upErr.message);await sb.from('notifications').insert((apps||[]).map(a=>({student_id:a.student_id,title:`Application ${status}`,body:`Your application status has been updated to ${status}.`,type:'Recruitment'})));await openTpoCandidates(jobId);await loadStats();}
async function shortlistAllRecommended(jobId){const {data:job,error}=await sb.from('jobs').select('*').eq('id',jobId).single();if(error)return alert(error.message);const {data:apps}=await sb.from('applications').select('*').eq('job_id',jobId);const ids=[...new Set((apps||[]).map(a=>a.student_id))];const {data:profiles}=ids.length?await sb.from('profiles').select('*').in('id',ids):{data:[]};let count=0;for(const a of apps||[]){const p=(profiles||[]).find(x=>x.id===a.student_id)||{};const m=smartMatch(p,job);if(m.score>=60){await sb.from('applications').update({status:'Shortlisted',match_score:m.score,missing_skills:m.missing}).eq('id',a.id);count++;}}alert(`${count} candidate(s) with a 60%+ match were shortlisted.`);await loadDrives();setTimeout(()=>openTpoCandidates(jobId),50);}
async function toggleDrive(id,active){const {error}=await sb.from('jobs').update({active:!active,status:active?'closed':'open'}).eq('id',id);if(error)alert(error.message);await loadDrives();}

async function scheduleInterview(appId,jobId,studentId){const date=prompt('Interview date/time (for example 2026-10-15T10:00):');if(!date)return;const mode=(prompt('Mode: Online or Offline','Online')||'Online').trim();let link='',location='';if(mode.toLowerCase().includes('online'))link=prompt('Meeting link (optional)','')||'';if(mode.toLowerCase().includes('offline'))location=prompt('Interview location','College / Company')||'';const iso=new Date(date);if(Number.isNaN(iso.getTime()))return alert('Invalid date/time.');const {error}=await sb.from('interviews').insert({job_id:jobId,student_id:studentId,scheduled_at:iso.toISOString(),mode,meeting_link:link,location});if(error)return alert(error.message);await sb.from('notifications').insert({student_id:studentId,title:'Interview scheduled',body:`An interview is scheduled for ${iso.toLocaleString()} (${mode}). ${link||location||''}`,type:'Interview'});alert('Interview scheduled.');await loadInterviews();}
async function loadInterviews(){const {data,error}=await sb.from('interviews').select('*,jobs(title,company)').order('scheduled_at');if(error)return el('tpoInterviewList').innerHTML=`<div class="error">${esc(error.message)}</div>`;el('tpoInterviewList').innerHTML=(data||[]).map(i=>`<div class="row"><span><b>${esc(i.jobs?.title||'Interview')}</b> · ${esc(i.jobs?.company||'')}<br><small>${new Date(i.scheduled_at).toLocaleString()} · ${esc(i.mode)} · ${esc(i.status)}</small></span></div>`).join('')||'<div class="empty">No interviews.</div>';}

async function loadHistory(){const {data,error}=await sb.from('placement_history').select('*').order('visit_date',{ascending:false});if(error)return el('historyList').innerHTML=`<div class="error">${esc(error.message)}</div>`;el('historyList').innerHTML=(data||[]).map(h=>`<div class="row"><span><b>${esc(h.company_name)}</b><br><small>${esc(h.visit_date||'')} · ${h.students_placed||0} placed · Highest ₹${h.highest_package||0} · Avg ₹${h.average_package||0}</small></span></div>`).join('')||'<div class="empty">No placement history.</div>';}
async function addHistory(){const company=el('hCompany').value.trim();if(!company)return alert('Enter company name.');const {error}=await sb.from('placement_history').insert({company_name:company,visit_date:el('hDate').value||null,students_placed:Number(el('hPlaced').value||0),highest_package:Number(el('hHighest').value||0),average_package:Number(el('hAverage').value||0),department:el('hDept').value.trim()});if(error)return alert(error.message);alert('Placement history added.');await loadAll();}

async function loadAlertOptions(){const {data:jobs}=await sb.from('jobs').select('id,title,company,active').order('created_at',{ascending:false});el('alertJob').innerHTML=(jobs||[]).map(j=>`<option value="${j.id}">${esc(j.title)} · ${esc(j.company)}${j.active?'':' · Closed'}</option>`).join('')||'<option value="">No drives</option>';const {data:students}=await sb.from('profiles').select('department').eq('role','student').eq('is_active',true);const deps=[...new Set((students||[]).map(s=>s.department).filter(Boolean))].sort();el('alertDepartment').innerHTML='<option value="">All departments</option>'+deps.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');}
async function sendJobAlert(){const jobId=el('alertJob').value;const title=el('alertTitle').value.trim();const body=el('alertBody').value.trim();const dept=el('alertDepartment').value;if(!jobId||!title||!body)return alert('Select a job and enter both title and message.');let q=sb.from('profiles').select('id,department').eq('role','student').eq('is_active',true);if(dept)q=q.eq('department',dept);const {data:students,error}=await q;if(error)return alert(error.message);if(!students?.length)return alert('No active students match this group.');const {error:ne}=await sb.from('notifications').insert(students.map(s=>({student_id:s.id,title,body,type:'Job Alert'})));if(ne)return alert(ne.message);el('alertMsg').textContent=` ✓ Alert sent to ${students.length} student(s).`;el('alertMsg').className='success';el('alertTitle').value='';el('alertBody').value='';}

async function loadMessageRecipients(){const type=el('msgRecipientType').value;if(type==='student'){const {data}=await sb.from('profiles').select('id,full_name,email,department').eq('role','student').order('full_name');el('msgRecipient').innerHTML=(data||[]).map(x=>`<option value="${x.id}">${esc(x.full_name||'Student')} · ${esc(x.department||'')} · ${esc(x.email||'')}</option>`).join('')||'<option value="">No students</option>';}else{const {data}=await sb.from('companies').select('id,name,user_id,email').order('name');el('msgRecipient').innerHTML=(data||[]).map(x=>`<option value="${x.id}" data-user="${x.user_id||''}">${esc(x.name||'Company')} · ${esc(x.email||'')}</option>`).join('')||'<option value="">No companies</option>';}}
async function sendTpoMessage(){const type=el('msgRecipientType').value;const recipient=el('msgRecipient').selectedOptions[0];const subject=el('tpoMsgSubject').value.trim();const body=el('tpoMsgBody').value.trim();if(!recipient?.value||!subject||!body)return alert('Select a recipient and enter a subject/message.');let payload={sender_id:tpoUser.id,subject,body};if(type==='student')payload.receiver_id=recipient.value;else{payload.company_id=recipient.value;payload.receiver_id=recipient.dataset.user||null;}const {error}=await sb.from('messages').insert(payload);const status=el('tpoMsgStatus');status.textContent=error?` ${error.message}`:' ✓ Message sent';status.className=error?'error':'success';if(!error){el('tpoMsgSubject').value='';el('tpoMsgBody').value='';await loadMessages();}}
async function loadMessages(){const {data,error}=await sb.from('messages').select('*').order('created_at',{ascending:false});if(error)return el('tpoMessages').innerHTML=`<div class="error">${esc(error.message)}</div>`;el('tpoMessages').innerHTML=(data||[]).map(m=>`<div class="row"><span><b>${esc(m.subject)}</b><br><small>${esc(m.body)}</small></span><small>${new Date(m.created_at).toLocaleString()}</small></div>`).join('')||'<div class="empty">No messages.</div>';}

async function loadHomeAds(){const box=el('tpoHomeAds');if(!box)return;const {data,error}=await sb.from('home_job_ads').select('*').order('created_at',{ascending:false});if(error){box.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}box.innerHTML=(data||[]).map(a=>`<div class="ad-review-card"><img src="${esc(a.poster_url)}" alt=""><div class="ad-review-copy"><div class="split-head"><div><span class="ad-status ${esc(a.status)}">${esc(a.status)}</span><h3>${esc(a.title)}</h3><b>${esc(a.company_name)}</b></div><small>${new Date(a.created_at).toLocaleString()}</small></div>${a.caption?`<p>${esc(a.caption)}</p>`:''}<div class="button-wrap">${a.status!=='approved'?`<button class="primary" onclick="approveHomeAd('${a.id}')">Approve & Publish</button>`:''}${a.status!=='rejected'?`<button class="danger" onclick="rejectHomeAd('${a.id}')">Reject</button>`:''}${a.status==='approved'?`<button class="outline-btn" onclick="archiveHomeAd('${a.id}')">Archive</button>`:''}<a class="outline-btn" target="_blank" rel="noopener" href="${esc(a.poster_url)}">View Poster</a></div></div></div>`).join('')||'<div class="empty">No job-ad posters submitted.</div>';}
async function approveHomeAd(id){const {error}=await sb.from('home_job_ads').update({status:'approved',active:true,approved_by:tpoUser.id,approved_at:new Date().toISOString(),rejection_reason:null}).eq('id',id);if(error)alert(error.message);await loadHomeAds();}
async function rejectHomeAd(id){const reason=prompt('Reason for rejection:')||'Not approved by TPO.';const {error}=await sb.from('home_job_ads').update({status:'rejected',active:false,approved_by:tpoUser.id,approved_at:new Date().toISOString(),rejection_reason:reason}).eq('id',id);if(error)alert(error.message);await loadHomeAds();}
async function archiveHomeAd(id){const {error}=await sb.from('home_job_ads').update({status:'archived',active:false}).eq('id',id);if(error)alert(error.message);await loadHomeAds();}
async function emailCompanyForJob(jobId){const {data:j}=await sb.from('jobs').select('company,company_id').eq('id',jobId).single();if(!j)return;const {data:c}=j.company_id?await sb.from('companies').select('email').eq('id',j.company_id).single():{data:null};if(!c?.email)return alert('Company email is not available.');location.href=`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent('Placement Drive · '+(j.title||''))}`;}

async function downloadShortlistedCVs(jobId){
  const {data:j,error:je}=await sb.from('jobs').select('*').eq('id',jobId).single();if(je||!j)return alert('Job not found.');
  el('bulkCvBox').classList.remove('hide');el('bulkCvTitle').textContent=`Shortlisted CVs · ${j.title}`;el('bulkCvStatus').textContent='Collecting shortlisted students…';
  const {data:apps,error}=await sb.from('applications').select('*').eq('job_id',jobId).eq('status','Shortlisted').order('applied_at',{ascending:true});if(error){el('bulkCvStatus').textContent=error.message;return}if(!apps?.length){el('bulkCvStatus').textContent='No shortlisted students for this job.';return}
  const ids=[...new Set(apps.map(a=>a.student_id))];const {data:profiles}=await sb.from('profiles').select('*').in('id',ids);const zip=new JSZip();let count=0;const failures=[];
  for(const app of apps){const p=(profiles||[]).find(x=>x.id===app.student_id)||{};try{const bytes=j.cv_template_url?await tpoPdfTemplateCV(j,p):await tpoWebCV(j,p);const name=`${safeFile(p.full_name||'Student')}_${safeFile(j.title||'CV')}.pdf`;zip.file(name,bytes);count++;}catch(e){failures.push(`${p.full_name||app.student_id}: ${e.message}`);}}
  if(!count){el('bulkCvStatus').textContent='No CVs could be generated. '+failures.join(' | ');return;}
  const blob=await zip.generateAsync({type:'blob'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${safeFile(j.company||'Company')}_${safeFile(j.title||'Job')}_Shortlisted_CVs.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);el('bulkCvStatus').textContent=`✓ ${count} separate CV PDF(s) packaged in one ZIP.${failures.length?' Some failed: '+failures.join(' | '):''}`;
}
function safeFile(s){return String(s||'').replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')||'Student';}
function tpoData(p){return {name:p?.full_name||'Student',email:p?.email||'',phone:p?.phone||'',dept:p?.department||'',roll:p?.roll_no||'',cgpa:p?.cgpa??'',skills:p?.skills||[],certs:p?.certifications||[],projects:p?.projects||[],location:p?.preferred_location||'',experience:p?.experience||''};}
async function tpoWebCV(job,p){
  const {PDFDocument,StandardFonts,rgb}=PDFLib;const pdf=await PDFDocument.create();let page=pdf.addPage([595,842]);const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);const d=tpoData(p);let y=790;let cfg=null;try{cfg=job?.cv_template?JSON.parse(job.cv_template):null}catch{}const style=cfg?.style||String(job?.cv_template_type||'web-professional').replace('web-','');const accent=style==='modern'?rgb(.08,.35,.58):style==='minimal'?rgb(.15,.15,.15):rgb(.04,.12,.23);page.drawText(d.name,{x:40,y,size:22,font:bold,color:accent});y-=20;page.drawText([d.email,d.phone,d.location].filter(Boolean).join(' · '),{x:40,y,size:9,font,color:rgb(.3,.38,.46),maxWidth:510});y-=26;const sections=cfg?.sections||['profile','education','skills','certs','projects','experience','location','job'];const sec=t=>{page.drawText(t.toUpperCase(),{x:40,y,size:10,font:bold,color:accent});page.drawLine({start:{x:40,y:y-4},end:{x:555,y:y-4},thickness:.6,color:rgb(.82,.86,.9)});y-=20};const line=t=>{page.drawText(String(t||'Not provided'),{x:40,y,size:10,font,color:rgb(.2,.3,.4),maxWidth:510});y-=22};for(const x of sections){if(y<90){page=pdf.addPage([595,842]);y=790;}if(x==='profile'){sec('Profile');line(`${d.dept||'Student'} · Roll No: ${d.roll||'—'} · CGPA: ${d.cgpa||'—'}`)}else if(x==='education'){sec('Education');line(`${d.dept||'Department / Branch'} · ${d.cgpa||'CGPA not provided'}`)}else if(x==='skills'){sec('Technical Skills');line(d.skills.join(', '))}else if(x==='certs'){sec('Certifications');for(const z of(d.certs.length?d.certs:['Not provided']))line('• '+z)}else if(x==='projects'){sec('Projects');for(const z of(d.projects.length?d.projects:['Not provided']))line('• '+z)}else if(x==='experience'){sec('Internship / Experience');line(d.experience)}else if(x==='location'){sec('Preferred Location');line(d.location)}else if(x==='job'){sec('Job Details');line(`${job?.title||''} · ${job?.company||''}`)}}return pdf.save();
}
async function tpoPdfTemplateCV(job,p){
  const res=await fetch(job.cv_template_url);if(!res.ok)throw new Error('Template could not be loaded.');const pdf=await PDFLib.PDFDocument.load(await res.arrayBuffer());const form=pdf.getForm();const fields=form.getFields();if(!fields.length)throw new Error('The uploaded PDF has no fillable fields.');const d=tpoData(p);const map={name:d.name,full_name:d.name,student_name:d.name,email:d.email,phone:d.phone,department:d.dept,branch:d.dept,rollno:d.roll,roll_number:d.roll,roll_no:d.roll,cgpa:String(d.cgpa||''),skills:d.skills.join(', '),technicalskills:d.skills.join(', '),certifications:d.certs.join(', '),projects:d.projects.join('\n'),experience:d.experience,preferredlocation:d.location,preferred_location:d.location,location:d.location,jobtitle:job.title||'',companyname:job.company||'',requiredskills:(job.required_skills||[]).join(', ')};
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');let filled=0;for(const f of fields){const n=norm(f.getName());const key=Object.keys(map).find(k=>n===norm(k)||n.includes(norm(k))||norm(k).includes(n));if(key&&typeof f.setText==='function'){try{f.setText(String(map[key]??''));filled++;}catch{}}}if(!filled)throw new Error('No matching named fields were found. Use fields such as FULL_NAME, EMAIL, PHONE, DEPARTMENT, ROLL_NO, CGPA, SKILLS, PROJECTS, EXPERIENCE.');try{form.flatten();}catch{}return pdf.save();
}

guard();
