const role = new URLSearchParams(location.search).get('role') === 'company' ? 'company' : 'student';
const $ = id => document.getElementById(id);
const student = role === 'student';

$('signupTitle').textContent = student ? 'Create your Student profile' : 'Register your Company';
$('signupIntro').textContent = student
  ? 'Create your profile once. Your registration will remain pending until the TPO or Administrator approves it.'
  : 'Register your organization. A TPO or Administrator must approve the company before recruitment access is enabled.';
$('studentMode').classList.toggle('active', student);
$('companyMode').classList.toggle('active', !student);
$('loginLink').href = `login.html?role=${role}`;
$('nameLabel').textContent = student ? 'Full name' : 'Company name';
$('fullName').placeholder = student ? 'Your full name' : 'Legal / registered company name';
$('studentFields').classList.toggle('hide', !student);
$('companyContactField').classList.toggle('hide', student);
$('companyWebsiteField').classList.toggle('hide', student);
$('rollWrap').classList.toggle('hide', !student);
$('cgpaWrap').classList.toggle('hide', !student);
$('qualificationWrap').classList.toggle('hide', !student);
$('locationWrap').classList.toggle('hide', !student);
$('skillsWrap').classList.toggle('hide', !student);
$('certsWrap').classList.toggle('hide', !student);
$('projectsWrap').classList.toggle('hide', !student);
$('experienceWrap').classList.toggle('hide', !student);
$('logoHint').classList.toggle('hide', false);
$('department').placeholder = student ? 'CSE / IT / ECE' : 'IT / Finance / Consulting';
$('department').previousElementSibling.textContent = student ? 'Department / Branch' : 'Industry / Business type';

$('signupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('signupBtn'), msg = $('signupMsg');
  const name = $('fullName').value.trim(), email = $('email').value.trim(), password = $('password').value;
  const confirm = $('confirmPassword').value;
  if (password !== confirm) { msg.textContent='Passwords do not match.'; msg.className='msg error'; return; }
  if (password.length < 8) { msg.textContent='Password must contain at least 8 characters.'; msg.className='msg error'; return; }
  btn.disabled = true; btn.textContent='Submitting registration…'; msg.textContent='';
  const meta = {
    signup_source:'self', role, full_name:name, department:$('department').value.trim(),
    phone:$('phone').value.trim(), roll_no:$('rollNo').value.trim(), cgpa:$('cgpa').value,
    qualification:$('qualification').value.trim(), preferred_location:$('preferredLocation').value.trim(),
    skills:$('skills').value.trim(), certifications:$('certifications').value.trim(), projects:$('projects').value.trim(),
    experience:$('experience').value.trim(), company_name:student?'':name,
    contact_name:$('contactName').value.trim(), website:$('website').value.trim()
  };
  try {
    const {data,error} = await sb.auth.signUp({email,password,options:{data:meta}});
    if(error) throw error;
    msg.textContent = data.session
      ? '✓ Registration submitted. Your account is pending approval. You can sign in after the TPO/Admin approves it.'
      : '✓ Registration created. Check your email if confirmation is required, then wait for TPO/Admin approval.';
    msg.className='msg success';
    $('signupForm').reset();
    if(data.session) setTimeout(async()=>{await sb.auth.signOut();},1000);
  } catch(err) {
    msg.textContent=err.message||'Unable to create registration.'; msg.className='msg error';
  } finally { btn.disabled=false; btn.textContent='Submit registration'; }
});
