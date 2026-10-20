(() => {
  const $ = (id) => document.getElementById(id);
  let db, user, profile, students = [];
  const today = new Date(); $('attendanceDate').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  function message(id, text, kind='') { const el=$(id); el.textContent=text; el.className='status '+kind; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function table(rows, columns) {
    if (!rows?.length) return '<p class="muted">No records yet.</p>';
    return '<div class="table-wrap"><table><thead><tr>'+columns.map(c=>'<th>'+esc(c.label)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+columns.map(c=>'<td>'+esc(c.value(r))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  async function loadNotices() {
    const {data,error}=await db.from('notices').select('title,body,created_at').eq('published',true).order('created_at',{ascending:false}).limit(10);
    if(error) { $('notices').textContent='Could not load notices: '+error.message; return; }
    $('notices').innerHTML=data.length ? data.map(n=>`<div class="notice"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><small class="muted">${esc(new Date(n.created_at).toLocaleDateString())}</small></div>`).join('') : '<p class="muted">No notices have been published.</p>';
  }
  async function getStudentRecords(studentId, attendanceTarget, marksTarget) {
    const [a,m]=await Promise.all([
      db.from('attendance').select('attendance_date,status').eq('student_id',studentId).order('attendance_date',{ascending:false}).limit(30),
      db.from('marks').select('subject,exam_name,obtained_marks,total_marks,created_at').eq('student_id',studentId).order('created_at',{ascending:false}).limit(50)
    ]);
    $(attendanceTarget).innerHTML=a.error ? '<p class="error">'+esc(a.error.message)+'</p>' : table(a.data,[{label:'Date',value:r=>r.attendance_date},{label:'Status',value:r=>r.status}]);
    $(marksTarget).innerHTML=m.error ? '<p class="error">'+esc(m.error.message)+'</p>' : table(m.data,[{label:'Exam',value:r=>r.exam_name},{label:'Subject',value:r=>r.subject},{label:'Marks',value:r=>`${r.obtained_marks} / ${r.total_marks}`}]);
  }
  async function initStudent() {
    $('studentPanel').hidden=false;
    const {data,error}=await db.from('students').select('id,full_name,admission_no,grade,section').eq('user_id',user.id).maybeSingle();
    if(error || !data) { $('studentAttendance').textContent='Your student record is not linked yet. Please contact the school office.'; $('studentMarks').textContent=''; return; }
    $('welcomeTitle').textContent='Welcome, '+(profile.full_name||data.full_name);
    $('roleLine').textContent=`Student · Grade ${data.grade} · Section ${data.section} · Admission no. ${data.admission_no}`;
    await getStudentRecords(data.id,'studentAttendance','studentMarks');
  }
  async function initParent() {
    $('parentPanel').hidden=false;
    const {data:links,error}=await db.from('student_guardians').select('student_id,students(id,full_name,admission_no,grade,section)').eq('guardian_user_id',user.id);
    if(error) { $('parentAttendance').textContent=error.message; return; }
    students=(links||[]).map(x=>x.students).filter(Boolean);
    if(!students.length) { $('childSelect').innerHTML='<option value="">No linked child yet</option>'; $('parentAttendance').textContent='Ask the school administrator to link your parent account to your child.'; return; }
    $('childSelect').innerHTML=students.map(s=>`<option value="${esc(s.id)}">${esc(s.full_name)} — Grade ${esc(s.grade)} ${esc(s.section)}</option>`).join('');
    $('childSelect').addEventListener('change',showParentChild); await showParentChild();
  }
  async function showParentChild(){const id=$('childSelect').value;if(id) await getStudentRecords(id,'parentAttendance','parentMarks');}
  async function initTeacher() {
    $('teacherPanel').hidden=false; $('marksPanel').hidden=false;
    const {data:assignments,error}=await db.from('teacher_assignments').select('grade,section,subject').eq('teacher_user_id',user.id);
    if(error) { message('attendanceMessage',error.message,'error'); return; }
    if(!assignments?.length) { message('attendanceMessage','No classes assigned yet. Ask the administrator to assign your grade and section.','error'); message('marksMessage','No classes assigned yet.','error'); return; }
    const clauses=assignments.map(a=>`and(grade.eq.${a.grade},section.eq.${a.section})`).join(',');
    const result=await db.from('students').select('id,full_name,admission_no,grade,section').eq('active',true).or(clauses).order('grade').order('full_name');
    if(result.error){message('attendanceMessage',result.error.message,'error');return;}
    students=result.data||[];
    const options=students.map(s=>`<option value="${esc(s.id)}">${esc(s.full_name)} — Grade ${esc(s.grade)} ${esc(s.section)} (${esc(s.admission_no)})</option>`).join('');
    $('attendanceStudent').innerHTML=options; $('marksStudent').innerHTML=options;
    if(!students.length){message('attendanceMessage','No students found in your assigned classes.','error');}
  }
  $('attendanceForm').addEventListener('submit',async e=>{
    e.preventDefault(); const studentId=$('attendanceStudent').value;
    const {error}=await db.from('attendance').upsert({student_id:studentId,attendance_date:$('attendanceDate').value,status:$('attendanceStatus').value,recorded_by:user.id},{onConflict:'student_id,attendance_date'});
    if(error) message('attendanceMessage','Could not save: '+error.message,'error'); else message('attendanceMessage','Attendance saved.','success');
  });
  $('marksForm').addEventListener('submit',async e=>{
    e.preventDefault(); const total=Number($('totalMarks').value), obtained=Number($('obtainedMarks').value);
    if(obtained>total){message('marksMessage','Obtained marks cannot be greater than total marks.','error');return;}
    const payload={student_id:$('marksStudent').value,exam_name:$('examName').value.trim(),subject:$('subject').value.trim(),total_marks:total,obtained_marks:obtained,entered_by:user.id};
    const {error}=await db.from('marks').upsert(payload,{onConflict:'student_id,subject,exam_name'});
    if(error) message('marksMessage','Could not save: '+error.message,'error'); else message('marksMessage','Marks saved.','success');
  });
  $('logoutButton').addEventListener('click',async()=>{await db.auth.signOut();location.href='login.html';});
  async function start(){
    if(!window.supabase||!window.SUPABASE_URL||window.SUPABASE_URL.includes('YOUR-PROJECT-REF')||!window.SUPABASE_ANON_KEY||window.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')){$('welcomeTitle').textContent='Portal setup is not finished';message('pageMessage','Fill in supabase-config.js first.');return;}
    db=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
    const {data:{session}}=await db.auth.getSession();
    if(!session){location.href='login.html';return;} user=session.user;
    const {data,error}=await db.from('profiles').select('full_name,role').eq('id',user.id).single();
    if(error||!data){await db.auth.signOut();location.href='login.html';return;} profile=data;
    $('welcomeTitle').textContent='Welcome, '+profile.full_name; $('roleLine').textContent='Account type: '+profile.role;
    await loadNotices();
    if(profile.role==='student') await initStudent();
    else if(profile.role==='parent') await initParent();
    else if(profile.role==='teacher') await initTeacher();
    else if(profile.role==='admin') $('adminPanel').hidden=false;
  }
  start().catch(err=>message('pageMessage',err.message||'Unexpected error.','error'));
})();
