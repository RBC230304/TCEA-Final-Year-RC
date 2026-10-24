async function loadHome(){
  try{
    const {data}=await sb.from('site_settings').select('*').eq('id',1).single();
    if(data){document.getElementById('siteName').textContent=data.site_name;document.getElementById('footerName').textContent=data.site_name;document.getElementById('heroText').textContent=data.hero_text;}
  }catch(e){}
  try{
    const {data:s}=await sb.from('placement_stats').select('*').eq('id',1).single();
    if(s){document.getElementById('sStudents').textContent=s.total_students||0;document.getElementById('sCompanies').textContent=s.companies||0;document.getElementById('sDrives').textContent=s.active_drives||0;document.getElementById('sPlaced').textContent=s.students_placed||0;}
  }catch(e){}
  await loadHomeJobAds();
  document.getElementById('year').textContent=new Date().getFullYear();
}

async function loadHomeJobAds(){
  const box=document.getElementById('homeJobAds');if(!box)return;
  const {data,error}=await sb.from('home_job_ads').select('id,title,company_name,poster_url,caption,job_id').eq('status','approved').eq('active',true).order('approved_at',{ascending:false});
  if(error){box.innerHTML='<div class="empty">Recruitment posters are temporarily unavailable.</div>';return;}
  box.innerHTML=(data||[]).map(a=>`<article class="ad-card"><a href="${escUrl(a.poster_url)}" target="_blank" rel="noopener"><img class="ad-poster-image" src="${escUrl(a.poster_url)}" alt="${escAttr(a.title)}"><div class="ad-card-body">${a.company_logo_url?`<div class="ad-company"><img src="${escUrl(a.company_logo_url)}" alt=""><b>${escHtml(a.company_name)}</b></div>`:`<b>${escHtml(a.company_name)}</b>`}<span class="ad-approved">TPO Approved</span><h3>${escHtml(a.title)}</h3>${a.caption?`<p>${escHtml(a.caption)}</p>`:''}<span class="ad-open">View advertisement ↗</span></div></a></article>`).join('')||'<div class="empty">No approved job advertisements have been published yet.</div>';
}
function escHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escAttr(s){return escHtml(s);}
function escUrl(s){return String(s||'').replace(/"/g,'%22').replace(/\s/g,'%20');}
loadHome();
