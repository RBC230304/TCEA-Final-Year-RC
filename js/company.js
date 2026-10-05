const withTimeout=window.withTimeout||async function(promise,ms=15000,label='Operation'){return await Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timed out. Check your internet connection and Supabase Storage.`)),ms))])};
let me=null, company=null, companyJobs=[], candidates=[], candidateProfiles=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=id=>document.getElementById(id);

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.panel').forEach(x=>x.classList.add('hide'));el(b.dataset.tab)?.classList.remove('hide');if(b.dataset.tab==='candidates')renderCandidates();if(b.dataset.tab==='job-posters')loadCompanyPosters();}));

async function init(){
  const {data:{user}}=await sb.auth.getUser();if(!user)return location.replace('login.html?role=company');
  const {data:p,error:pe}=await sb.from('profiles').select('*').eq('id',user.id).single();if(pe||p?.role!=='company')return location.replace('index.html');
  if(p.is_active===false){alert('Your company account is inactive. Contact the TPO.');await sb.auth.signOut();return location.replace('index.html');}
  me=p;
  let {data:c}=await sb.from('companies').select('*').eq('user_id',user.id).maybeSingle();
  if(!c){const ins=await sb.from('companies').insert({user_id:user.id,name:p.full_name||'Company',email:p.email||''}).select('*').single();c=ins.data||null;}
  company=c||{user_id:user.id,name:p.full_name||'Company',email:p.email||'',verified:false};
  fillCompany();updateVerification();await loadAll();
}
function fillCompany(){el('companyTitle').textContent=company.name||'Company Recruitment';el('cName').value=company.name||'';el('cContact').value=company.contact_name||'';el('cEmail').value=company.email||me.email||'';el('cPhone').value=company.phone||'';el('cWebsite').value=company.website||'';const img=el('companyLogo'),ph=el('companyLogoPlaceholder'),head=el('headerCompanyLogo');if(head){head.src=company.logo_url||'';head.classList.toggle('visible',!!company.logo_url);}if(img&&ph){if(company.logo_url){img.src=company.logo_url;img.classList.add('visible');ph.classList.add('hide');}else{img.src='';img.classList.remove('visible');ph.classList.remove('hide');ph.textContent=(company.name||'Company').slice(0,2).toUpperCase();}}}
function updateVerification(){const b=el('companyVerification');if(company.verified){b.className='status-banner success-banner';b.innerHTML='<b>✓ Verified company</b><span>You can publish placement drives and manage applicants.</span>';}else{b.className='status-banner warning-banner';b.innerHTML='<b>Pending TPO verification</b><span>Complete your profile and ask the TPO to verify this company before publishing a job.</span>';}}
async function saveCompany(){const name=el('cName').value.trim();if(!name)return alert('Company name is required.');const patch={user_id:me.id,name,contact_name:el('cContact').value.trim(),email:el('cEmail').value.trim(),phone:el('cPhone').value.trim(),website:el('cWebsite').value.trim()};const {data,error}=await sb.from('companies').upsert(patch,{onConflict:'user_id'}).select('*').single();const m=el('companyMsg');m.textContent=error?` ${error.message}`:' ✓ Company profile saved';m.className=error?'error':'success';if(!error&&data){company=data;fillCompany();updateVerification();await loadAll();}}
async function populatePosterJobs(){
  const box=el('posterJob'); if(!box) return;
  let drives=[...companyJobs];
  // Backward-compatible fallback for drives created before company_id was populated.
  if(!drives.length){
    const {data:legacy}=await sb.from('jobs').select('*').eq('active',true).eq('company',company.name).order('created_at',{ascending:false});
    drives=legacy||[];
    if(drives.length){ companyJobs=drives; renderCompanyJobs(); populateCandidateJobFilter(); }
  }
  box.innerHTML='<option value="">Select a placement drive</option>'+drives.map(j=>`<option value="${j.id}">${esc(j.title)} · ${esc(j.location||'')} · ${j.active?'Open':'Closed'}</option>`).join('');
  if(!drives.length){
    box.insertAdjacentHTML('beforeend','<option value="" disabled>No active placement drive found — create a job first.</option>');
  }
}
async function loadCompanyPosters(){const box=el('companyPosters');if(!box)return;const {data,error}=await sb.from('home_job_ads').select('*').eq('created_by',me.id).order('created_at',{ascending:false});if(error){box.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}box.innerHTML=(data||[]).map(a=>`<div class="poster-admin-row"><div><b>${esc(a.title)}</b><small>${esc(a.company_name)} · ${esc(a.status)}${a.rejection_reason?' · '+esc(a.rejection_reason):''}</small></div><span class="poster-status poster-${esc(a.status)}">${esc(a.status)}</span></div>`).join('')||'<div class="empty">No posters submitted yet.</div>';}
async function uploadCompanyLogo(){
  const file=el('companyLogoFile')?.files?.[0],msg=el('companyLogoMsg');
  if(!file){if(msg){msg.textContent=' Choose a JPG, PNG or WEBP logo first.';msg.className='error';}return;}
  if(file.size>5*1024*1024){if(msg){msg.textContent=' Please keep the logo under 5 MB.';msg.className='error';}return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){if(msg){msg.textContent=' Only JPG, PNG and WEBP images are supported.';msg.className='error';}return;}
  if(msg){msg.textContent=' Uploading logo…';msg.className='muted';}
  try{
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const path=`${me.id}/logo-${Date.now()}.${ext}`;
    const up=await withTimeout(sb.storage.from('company-logos').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'}),15000,'Company logo upload');
    if(up.error)throw up.error;
    const url=sb.storage.from('company-logos').getPublicUrl(path).data.publicUrl+`?v=${Date.now()}`;
    const {data,error}=await withTimeout(sb.from('companies').update({logo_url:url}).eq('id',company.id).select('*').single(),15000,'Company profile update');
    if(error)throw error;company=data;fillCompany();el('companyLogoFile').value='';
    if(msg){msg.textContent=' ✓ Company logo uploaded successfully.';msg.className='success';}
  }catch(e){if(msg){msg.textContent=` ${e?.message||e}`;msg.className='error';}}
}
async function submitJobPoster(){
  if(!company?.verified)return alert('Your company must be verified by the TPO before submitting a homepage job poster.');
  const jobId=el('posterJob').value,title=el('posterTitle').value.trim(),caption=el('posterCaption').value.trim(),file=el('posterFile')?.files?.[0];
  if(!jobId||!title||!file)return alert('Select a placement drive, enter a title and choose a poster image.');
  if(file.size>6*1024*1024)return alert('Please keep the poster under 6 MB.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return alert('Only JPG, PNG and WEBP posters are supported.');
  const job=companyJobs.find(j=>j.id===jobId); if(!job)return alert('The selected placement drive could not be found. Refresh the page and try again.');
  const msg=el('posterMsg');msg.textContent=' Uploading poster…';msg.className='muted';
  try{
    const path=`${me.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const up=await withTimeout(sb.storage.from('job-posters').upload(path,file,{contentType:file.type,upsert:false}),15000,'Job poster upload');
    if(up.error)throw up.error;
    const url=sb.storage.from('job-posters').getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`;
    const {error}=await withTimeout(sb.from('home_job_ads').insert({job_id:jobId,company_id:company.id,title,company_name:company.name,poster_url:url,poster_name:file.name,caption,created_by:me.id,company_logo_url:company.logo_url||null,status:'pending',active:false}),15000,'Poster submission');
    if(error)throw error;
    msg.textContent=' ✓ Poster submitted for TPO/Admin approval.';msg.className='success';
    ['posterTitle','posterCaption'].forEach(x=>el(x).value='');el('posterFile').value='';await loadCompanyPosters();
  }catch(e){msg.textContent=` ${e?.message||e}`;msg.className='error';}
}
async function loadAll(){
  if(!company?.id)return;
  const {data:jobs,error}=await sb.from('jobs').select('*').eq('company_id',company.id).order('created_at',{ascending:false});if(error){el('companyJobs').innerHTML=`<div class="error">${esc(error.message)}</div>`;return}companyJobs=jobs||[];renderCompanyJobs();populateCandidateJobFilter();populatePosterJobs();
  const ids=companyJobs.map(j=>j.id);const {data:apps,error:ae}=ids.length?await sb.from('applications').select('*,jobs(id,title,company,company_id,required_skills,min_cgpa,location)').in('job_id',ids).order('applied_at',{ascending:false}):{data:[],error:null};
  if(ae){el('candidateList').innerHTML=`<div class="error">${esc(ae.message)}</div>`;return}candidates=apps||[];
  const studentIds=[...new Set(candidates.map(a=>a.student_id))];const {data:profiles}=studentIds.length?await sb.from('profiles').select('*').in('id',studentIds):{data:[]};candidateProfiles=new Map((profiles||[]).map(p=>[p.id,p]));
  renderCandidates();await renderCompanyInterviews();await renderMessages();await loadCompanyPosters();updateStats();
}
function renderCompanyJobs(){el('companyJobs').innerHTML=companyJobs.map(j=>`<div class="row"><span><b>${esc(j.title)}</b><br><small>${esc(j.location||'')} · ${esc(j.interview_mode||'Online')} · ${j.active?'Open':'Closed'} · CV: ${esc(j.cv_template_name||j.cv_template_type||'Website')} · ${Array.isArray(j.cv_required_fields)?j.cv_required_fields.filter(f=>f.required).length:0} required field(s)</small></span><span><button class="outline-btn" onclick="editCompanyCVRequirements('${j.id}')">CV Fields</button><button class="outline-btn" onclick="toggleJob('${j.id}',${!!j.active})">${j.active?'Close':'Reopen'}</button><button class="danger" onclick="deleteJob('${j.id}')">Delete</button></span></div>`).join('')||'<div class="empty">No jobs posted yet.</div>';}
function populateCandidateJobFilter(){const cur=el('companyCandidateJob').value;el('companyCandidateJob').innerHTML='<option value="">All jobs</option>'+companyJobs.map(j=>`<option value="${j.id}">${esc(j.title)} · ${esc(j.company||company.name)}</option>`).join('');if(companyJobs.some(j=>j.id===cur))el('companyCandidateJob').value=cur;}
function smartMatch(profile,job){const cv=[...(profile?.skills||[]),...(profile?.certifications||[]),...(profile?.projects||[]),profile?.resume_text||'',profile?.resume_name||''].join(' ').toLowerCase();const skills=(job?.required_skills||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean);const hit=skills.filter(s=>cv.includes(s));let score=skills.length?hit.length/skills.length*70:50;if(profile?.cgpa!=null&&job?.min_cgpa!=null&&Number(profile.cgpa)>=Number(job.min_cgpa))score+=20;if(job?.location&&profile?.preferred_location&&job.location.toLowerCase().includes(profile.preferred_location.toLowerCase()))score+=10;return {score:Math.min(100,Math.round(score)),missing:skills.filter(s=>!hit.includes(s))};}
function renderCandidates(){const jobId=el('companyCandidateJob').value;const status=el('companyCandidateStatus').value;const list=candidates.filter(a=>(!jobId||a.job_id===jobId)&&(!status||a.status===status));el('candidateList').innerHTML=list.map(a=>{const p=candidateProfiles.get(a.student_id)||{};const j=a.jobs||{};const m=smartMatch(p,j);return `<div class="candidate-card"><div><b>${esc(p.full_name||'Student')}</b><div class="muted small-line">${esc(j.title||'Job')} · ${esc(p.department||'')} · CGPA ${p.cgpa??'—'} · ${esc(p.email||'')}</div><div class="match-line"><b>CV Match ${m.score}%</b>${m.missing.length?`<span>Missing: ${esc(m.missing.join(', '))}</span>`:'<span>All key skills found</span>'}</div><div class="muted small-line">Status: <b>${esc(a.status)}</b></div></div><div class="candidate-actions"><select onchange="setStatus('${a.id}',this.value)"><option ${a.status==='Applied'?'selected':''}>Applied</option><option ${a.status==='Shortlisted'?'selected':''}>Shortlisted</option><option ${a.status==='Selected'?'selected':''}>Selected</option><option ${a.status==='Rejected'?'selected':''}>Rejected</option></select><a class="outline-btn" href="mailto:${esc(p.email||'')}">Email</a><button class="outline-btn" onclick="scheduleInterview('${a.job_id}','${a.student_id}')">Interview</button>${a.status==='Selected'?`<button class="outline-btn" onclick="offerLetter('${a.id}')">Offer Letter</button>`:''}</div></div>`;}).join('')||'<div class="empty">No applicants match the selected filters.</div>';
  if(jobId){const shortlisted=list.filter(a=>a.status==='Shortlisted');if(shortlisted.length)el('candidateList').insertAdjacentHTML('afterbegin',`<div class="candidate-toolbar"><button class="outline-btn" onclick="shortlistRecommended('${jobId}')">Shortlist recommended</button><button class="outline-btn" onclick="emailShortlisted('${jobId}')">Email shortlisted</button></div>`);}
}
async function setStatus(id,status){const {data:a,error}=await sb.from('applications').update({status}).eq('id',id).select('student_id,job_id').single();if(error)return alert(error.message);if(a)await sb.from('notifications').insert({student_id:a.student_id,title:`Application ${status}`,body:`Your application status has been updated to ${status}.`,type:'Recruitment'});await loadAll();}
async function shortlistRecommended(jobId){const job=companyJobs.find(j=>j.id===jobId);if(!job)return;let count=0;for(const a of candidates.filter(x=>x.job_id===jobId)){const p=candidateProfiles.get(a.student_id)||{};const m=smartMatch(p,job);if(m.score>=60){await sb.from('applications').update({status:'Shortlisted',match_score:m.score,missing_skills:m.missing}).eq('id',a.id);count++;}}alert(`${count} candidate(s) with a 60%+ match were shortlisted.`);await loadAll();el('companyCandidateJob').value=jobId;renderCandidates();}
async function scheduleInterview(jobId,studentId){const date=prompt('Interview date/time (example: 2026-10-15T10:00):');if(!date)return;const iso=new Date(date);if(Number.isNaN(iso.getTime()))return alert('Invalid date/time.');const mode=(prompt('Mode: Online or Offline','Online')||'Online').trim();const link=mode.toLowerCase().includes('online')?prompt('Meeting link (optional)','')||'':'';const location=mode.toLowerCase().includes('offline')?prompt('Interview location','College / Company')||'':'';const {error}=await sb.from('interviews').insert({job_id:jobId,student_id:studentId,scheduled_at:iso.toISOString(),mode,meeting_link:link,location});if(error)return alert(error.message);await sb.from('notifications').insert({student_id:studentId,title:'Interview scheduled',body:`An interview is scheduled for ${iso.toLocaleString()} (${mode}). ${link||location||''}`,type:'Interview'});alert('Interview scheduled.');await loadAll();}
async function renderCompanyInterviews(){const ids=companyJobs.map(j=>j.id);if(!ids.length){el('companyInterviewList').innerHTML='<div class="empty">No interviews.</div>';return}const {data,error}=await sb.from('interviews').select('*,jobs(title)').in('job_id',ids).order('scheduled_at');if(error)return el('companyInterviewList').innerHTML=`<div class="error">${esc(error.message)}</div>`;el('companyInterviewList').innerHTML=(data||[]).map(i=>`<div class="row"><span><b>${esc(i.jobs?.title||'Interview')}</b><br><small>${new Date(i.scheduled_at).toLocaleString()} · ${esc(i.mode)} · ${esc(i.status)}${i.location?' · '+esc(i.location):''}</small></span>${i.meeting_link?`<a class="outline-btn" target="_blank" rel="noopener" href="${esc(i.meeting_link)}">Join</a>`:''}</div>`).join('')||'<div class="empty">No interviews.</div>';}
async function sendTPO(){const subject=el('mSubject').value.trim(),body=el('mBody').value.trim();if(!subject||!body)return alert('Enter a subject and message.');const {data:tpos,error:te}=await sb.from('profiles').select('id').eq('role','tpo').eq('is_active',true).limit(1);if(te||!tpos?.length){el('messageMsg').textContent='No active TPO account is available.';el('messageMsg').className='error';return}const {error}=await sb.from('messages').insert({sender_id:me.id,receiver_id:tpos[0].id,company_id:company.id,subject,body});el('messageMsg').textContent=error?` ${error.message}`:' ✓ Message sent';el('messageMsg').className=error?'error':'success';if(!error){el('mSubject').value='';el('mBody').value='';await renderMessages();}}
async function renderMessages(){const {data,error}=await sb.from('messages').select('*').eq('company_id',company.id).order('created_at',{ascending:false});if(error)return el('messageList').innerHTML=`<div class="error">${esc(error.message)}</div>`;el('messageList').innerHTML=(data||[]).map(m=>`<div class="row"><span><b>${esc(m.subject)}</b><br><small>${esc(m.body)}</small></span><small>${new Date(m.created_at).toLocaleString()}</small></div>`).join('')||'<div class="empty">No messages yet.</div>';}
async function offerLetter(id){const {data:a}=await sb.from('applications').select('*,jobs(title,company)').eq('id',id).single();if(!a)return;const p=candidateProfiles.get(a.student_id);const html=`OFFER LETTER\n\nDate: ${new Date().toLocaleDateString()}\n\nDear ${p?.full_name||'Candidate'},\n\nWe are pleased to offer you the position of ${a.jobs?.title||'the advertised role'} at ${company.name}.\n\nPlease contact the Training & Placement Office for joining and compensation details.\n\nSincerely,\n${company.contact_name||company.name}`;const blob=new Blob([html],{type:'text/plain'});const u=URL.createObjectURL(blob);const aTag=document.createElement('a');aTag.href=u;aTag.download=`Offer_Letter_${safeFile(p?.full_name||'Candidate')}.txt`;aTag.click();setTimeout(()=>URL.revokeObjectURL(u),1000);if(p?.email)location.href=`mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent('Offer Letter · '+(a.jobs?.title||''))}`;}
async function emailShortlisted(jobId){const job=companyJobs.find(j=>j.id===jobId);const list=candidates.filter(a=>a.job_id===jobId&&a.status==='Shortlisted').map(a=>candidateProfiles.get(a.student_id)?.email).filter(Boolean);if(!list.length)return alert('No shortlisted students for this job.');location.href=`mailto:?bcc=${encodeURIComponent(list.join(','))}&subject=${encodeURIComponent('Shortlisted · '+(job?.title||'Placement Drive'))}`;}
function updateStats(){el('driveCount').textContent=companyJobs.filter(j=>j.active).length;el('candidateCount').textContent=candidates.length;el('shortlistCount').textContent=candidates.filter(a=>a.status==='Shortlisted').length;el('selectedCount').textContent=candidates.filter(a=>a.status==='Selected').length;}
async function toggleJob(id,active){const {error}=await sb.from('jobs').update({active:!active,status:active?'closed':'open'}).eq('id',id);if(error)alert(error.message);await loadAll();}
async function deleteJob(id){if(!confirm('Delete this job and its applications?'))return;const {error}=await sb.from('jobs').delete().eq('id',id);if(error)alert(error.message);await loadAll();}
async function validatePdfFile(file){try{const pdf=await PDFLib.PDFDocument.load(await file.arrayBuffer());return pdf.getForm().getFields().length;}catch{return 0;}}
async function postJob(){
  if(!company?.verified)return alert('Your company account must be verified by the TPO before you can publish a placement drive.');
  const title=el('jTitle').value.trim();if(!title)return alert('Job title is required.');
  const skills=el('jSkills').value.split(',').map(x=>x.trim()).filter(Boolean);let cvUrl=null,cvName=null;const type=el('jTemplateType').value;const file=el('jTemplatePdf')?.files?.[0];
  if(type==='pdf'){if(!file)return alert('Choose a PDF CV template.');const fields=await validatePdfFile(file);if(!fields)return alert('The selected PDF has no fillable form fields. Upload a fillable PDF with named fields.');const safe=`company/${company.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const up=await sb.storage.from('cv-templates').upload(safe,file,{contentType:'application/pdf',upsert:true});if(up.error)return alert('Template upload failed: '+up.error.message);cvUrl=sb.storage.from('cv-templates').getPublicUrl(safe).data.publicUrl;cvName=file.name;el('templateCheckMsg').textContent=`✓ ${fields} fillable field(s) detected.`;}
  const cfg=type==='pdf'?null:cvBuilderConfig('cvb');
  const requiredFields=typeof collectCVFieldBuilder==='function'?collectCVFieldBuilder('company'):[];
  const row={title,company:company.name,company_id:company.id,location:el('jLocation').value.trim(),min_cgpa:el('jCgpa').value?Number(el('jCgpa').value):0,required_skills:skills,requirements:el('jRequirements').value.trim(),shortlist_criteria:`${el('jCriteria').value.trim()} | Backlog rule: ${el('jBacklog').value}`,cv_template:type==='pdf'?'PDF fillable template':JSON.stringify(cfg),cv_required_fields:requiredFields,cv_template_type:type,cv_template_url:cvUrl,cv_template_name:cvName||'Website CV Template',interview_mode:el('jMode').value,deadline:el('jDeadline').value||null,active:true,status:'open'};
  const {error}=await sb.from('jobs').insert(row);const msg=el('jobMsg');if(error){msg.textContent=` ${error.message}`;msg.className='error';return}msg.textContent=' ✓ Job published successfully.';msg.className='success';['jTitle','jLocation','jCgpa','jSkills','jTemplate','jRequirements','jCriteria','jDeadline'].forEach(id=>el(id).value='');el('jTemplatePdf').value='';if(typeof renderCVFieldBuilder==='function')renderCVFieldBuilder('company');await loadAll();
}
function safeFile(s){return String(s||'').replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')||'Candidate';}
async function editCompanyCVRequirements(jobId){
  const job=companyJobs.find(x=>x.id===jobId);if(!job)return;
  const wrap=document.createElement('div');wrap.className='cv-modal-backdrop';wrap.innerHTML=`<div class="cv-modal"><div class="cv-modal-head"><div><div class="kicker">Job CV requirements</div><h3>${esc(job.title)}</h3><p class="muted">Add, remove or mark fields as required. Students must complete required information before their job-specific CV can be generated.</p></div><button class="secondary" type="button">Close</button></div><div class="cv-requirements-builder" data-cv-builder-fields="modal"></div><div class="cv-actions"><button class="primary" type="button" id="saveCompanyCVReq">Save requirements</button></div></div>`;
  document.body.appendChild(wrap);renderCVFieldBuilder('modal',job.cv_required_fields||[]);
  wrap.querySelector('.cv-modal-head .secondary').onclick=()=>wrap.remove();
  wrap.querySelector('#saveCompanyCVReq').onclick=async()=>{const fields=collectCVFieldBuilder('modal');const {error}=await sb.from('jobs').update({cv_required_fields:fields}).eq('id',jobId);if(error)return alert(error.message);alert('CV requirements saved.');wrap.remove();await loadAll();};
}

init();
