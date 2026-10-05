/* Shared CV field builder + student field form. */
const CV_FIELD_CATALOG = [
  {key:'full_name', label:'Full Name', type:'text', standard:true},
  {key:'email', label:'Email Address', type:'email', standard:true},
  {key:'phone', label:'Phone Number', type:'text', standard:true},
  {key:'profile_picture', label:'Profile Picture', type:'image', standard:true},
  {key:'roll_no', label:'Roll Number', type:'text', standard:true},
  {key:'department', label:'Department / Branch', type:'text', standard:true},
  {key:'qualification', label:'Qualification', type:'text', standard:true},
  {key:'cgpa', label:'CGPA / Percentage', type:'text', standard:true},
  {key:'skills', label:'Technical Skills', type:'textarea', standard:true},
  {key:'certifications', label:'Certifications', type:'textarea', standard:true},
  {key:'projects', label:'Projects', type:'textarea', standard:true},
  {key:'experience', label:'Internship / Experience', type:'textarea', standard:true},
  {key:'preferred_location', label:'Preferred Job Location', type:'text', standard:true},
  {key:'linkedin', label:'LinkedIn URL', type:'url'},
  {key:'github', label:'GitHub URL', type:'url'},
  {key:'portfolio', label:'Portfolio URL', type:'url'},
  {key:'address', label:'Current Address', type:'textarea'},
  {key:'career_objective', label:'Career Objective / Summary', type:'textarea'},
];

const _cvEsc=(typeof esc==='function')?esc:(s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
function cvFieldCatalogEntry(key){return CV_FIELD_CATALOG.find(f=>f.key===key);}
function slugField(s){return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);}
function normalizeCVFields(fields){
  const seen=new Set(); const out=[];
  for(const raw of (Array.isArray(fields)?fields:[])){
    const key=slugField(raw?.key||raw?.label); if(!key||seen.has(key))continue; seen.add(key);
    const cat=cvFieldCatalogEntry(key);
    out.push({key,label:String(raw?.label||cat?.label||key).trim(),type:raw?.type||cat?.type||'text',required:!!raw?.required,placeholder:String(raw?.placeholder||'').trim()});
  }
  return out;
}
function defaultCVRequiredFields(){
  return normalizeCVFields([
    {key:'full_name',required:true},{key:'email',required:true},{key:'phone',required:true},
    {key:'department',required:true},{key:'qualification',required:true},{key:'cgpa',required:true},
    {key:'skills',required:true},{key:'projects',required:false}
  ]);
}
function getBuilderRoot(prefix){return document.querySelector(`[data-cv-builder-fields="${prefix}"]`);}
function renderCVFieldBuilder(prefix='company', saved=[]){
  const root=getBuilderRoot(prefix); if(!root)return;
  const fields=normalizeCVFields(saved.length?saved:defaultCVRequiredFields());
  root.innerHTML=`
    <div class="cv-fields-head">
      <div><div class="kicker">CV data requirements</div><h4>Choose / add information required from students</h4><p class="muted">Tick a field to request it. Use <b>Required</b> when a student must provide it before their job-specific CV can be generated.</p></div>
      <button type="button" class="secondary cv-add-field" data-cv-add="${prefix}">+ Add custom field</button>
    </div>
    <div class="cv-standard-grid">
      ${CV_FIELD_CATALOG.map(f=>{
        const current=fields.find(x=>x.key===f.key);
        const enabled=!!current;
        return `<label class="cv-field-option"><input type="checkbox" class="cv-field-enabled" data-key="${_cvEsc(f.key)}" ${enabled?'checked':''}><span class="cv-field-main"><b>${_cvEsc(f.label)}</b><small>${f.standard?'Standard field':'Custom-ready field'}</small></span><span class="cv-field-req"><input type="checkbox" class="cv-field-required" data-key="${_cvEsc(f.key)}" ${enabled&&current.required?'checked':''} ${enabled?'':'disabled'}> Required</span></label>`;
      }).join('')}
    </div>
    <div class="cv-custom-list" data-cv-custom-list="${prefix}"></div>`;
  const custom=fields.filter(f=>!cvFieldCatalogEntry(f.key));
  const list=root.querySelector(`[data-cv-custom-list="${prefix}"]`); custom.forEach(f=>appendCustomCVField(prefix,f));
  root.querySelectorAll('.cv-field-enabled').forEach(ch=>ch.addEventListener('change',()=>{const req=[...root.querySelectorAll('.cv-field-required')].find(x=>x.dataset.key===ch.dataset.key);if(req)req.disabled=!ch.checked;if(!ch.checked&&req)req.checked=false;}));
  root.querySelector(`[data-cv-add="${prefix}"]`)?.addEventListener('click',()=>appendCustomCVField(prefix,{key:'',label:'',type:'text',required:false,placeholder:''}));
}
function appendCustomCVField(prefix,field){
  const root=getBuilderRoot(prefix), list=root?.querySelector(`[data-cv-custom-list="${prefix}"]`);if(!list)return;
  const row=document.createElement('div');row.className='cv-custom-row';
  row.innerHTML=`<input class="cv-custom-key" placeholder="field_key" value="${_cvEsc(field.key||'')}"><input class="cv-custom-label" placeholder="Field label" value="${_cvEsc(field.label||'')}"><select class="cv-custom-type"><option value="text">Text</option><option value="textarea">Long text</option><option value="email">Email</option><option value="url">URL</option><option value="date">Date</option></select><label><input class="cv-custom-required" type="checkbox" ${field.required?'checked':''}> Required</label><button type="button" class="danger cv-custom-remove" aria-label="Remove custom field">Remove</button>`;
  row.querySelector('.cv-custom-type').value=['text','textarea','email','url','date'].includes(field.type)?field.type:'text';
  if(field.placeholder)row.dataset.placeholder=field.placeholder;
  row.querySelector('.cv-custom-remove').addEventListener('click',()=>row.remove());list.appendChild(row);
}
function collectCVFieldBuilder(prefix='company'){
  const root=getBuilderRoot(prefix);if(!root)return [];
  const out=[];
  root.querySelectorAll('.cv-field-enabled:checked').forEach(ch=>{
    const key=slugField(ch.dataset.key); const cat=cvFieldCatalogEntry(key); const req=[...root.querySelectorAll('.cv-field-required')].find(x=>x.dataset.key===key);
    out.push({key,label:cat?.label||key,type:cat?.type||'text',required:!!req?.checked});
  });
  root.querySelectorAll('.cv-custom-row').forEach(row=>{
    const key=slugField(row.querySelector('.cv-custom-key')?.value);const label=String(row.querySelector('.cv-custom-label')?.value||'').trim();if(!key||!label)return;
    out.push({key,label,type:row.querySelector('.cv-custom-type')?.value||'text',required:!!row.querySelector('.cv-custom-required')?.checked,placeholder:row.dataset.placeholder||''});
  });
  return normalizeCVFields(out);
}
function findCVFieldValue(profile,key){
  const standard={
    full_name:profile?.full_name||'',email:profile?.email||'',phone:profile?.phone||'',profile_picture:profile?.profile_picture_url||'',
    roll_no:profile?.roll_no||'',department:profile?.department||'',qualification:profile?.qualification||'',cgpa:profile?.cgpa??'',
    skills:Array.isArray(profile?.skills)?profile.skills.join(', '):'',certifications:Array.isArray(profile?.certifications)?profile.certifications.join(', '):'',
    projects:Array.isArray(profile?.projects)?profile.projects.join('\n'):'',experience:profile?.experience||'',preferred_location:profile?.preferred_location||''
  };
  return standard[key] ?? profile?.profile_extra_fields?.[key] ?? '';
}
function missingRequiredCVFields(job,profile){
  const fields=normalizeCVFields(job?.cv_required_fields);return fields.filter(f=>f.required&&!String(findCVFieldValue(profile,f.key)||'').trim());
}
function renderStudentCVFields(containerId,job,profile){
  const root=document.getElementById(containerId);if(!root)return;
  const fields=normalizeCVFields(job?.cv_required_fields);if(!fields.length){root.innerHTML='<div class="cv-requirements-empty">This job has no additional CV data requirements. Your saved profile will be used.</div>';return;}
  root.innerHTML=`<div class="cv-requirements-panel"><div class="kicker">Employer / TPO requirements</div><h4>Information required for this job</h4><p class="muted">Complete the fields marked <b>Required</b> before downloading the job-specific CV.</p><div class="cv-student-fields">${fields.map(f=>{const val=findCVFieldValue(profile,f.key);const ph=f.placeholder||`Enter ${f.label.toLowerCase()}`;const req=f.required?' required':'';const input=f.type==='textarea'?`<textarea data-extra-field="${_cvEsc(f.key)}" placeholder="${_cvEsc(ph)}"${req}>${_cvEsc(val)}</textarea>`:f.type==='image'?`<div class="cv-image-note">Uses your saved profile picture.</div>`:`<input data-extra-field="${_cvEsc(f.key)}" type="${f.type==='date'?'date':f.type==='url'?'url':f.type==='email'?'email':'text'}" value="${_cvEsc(val)}" placeholder="${_cvEsc(ph)}"${req}>`;return `<div class="${f.type==='textarea'?'wide':''}"><label>${_cvEsc(f.label)} ${f.required?'<span class="req-star">*</span>':''}</label>${input}</div>`}).join('')}</div><div class="cv-field-actions"><button type="button" class="secondary" onclick="saveJobCVFields()">Save required information</button><span id="jobCVFieldMsg" class="muted"></span></div></div>`;
}
async function saveStudentCVFields(job){
  if(!window.sb||!window.me)return {error:new Error('Session not ready')};
  const root=document.getElementById('jobCVRequiredFields');if(!root)return {data:window.me};
  const extras={...(window.me.profile_extra_fields||{})};root.querySelectorAll('[data-extra-field]').forEach(input=>{extras[input.dataset.extraField]=input.value.trim();});
  const {data,error}=await sb.from('profiles').update({profile_extra_fields:extras}).eq('id',window.me.id).select('*').single();if(!error)window.me=data;return {data,error};
}
window.CV_FIELD_CATALOG=CV_FIELD_CATALOG;window.normalizeCVFields=normalizeCVFields;window.renderCVFieldBuilder=renderCVFieldBuilder;window.collectCVFieldBuilder=collectCVFieldBuilder;window.renderStudentCVFields=renderStudentCVFields;window.findCVFieldValue=findCVFieldValue;window.missingRequiredCVFields=missingRequiredCVFields;window.saveStudentCVFields=saveStudentCVFields;
