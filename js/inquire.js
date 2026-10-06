(function(){
'use strict';
var form=document.getElementById('inquiryForm');
var success=document.getElementById('inquirySuccess');
var road=document.getElementById('inqRoad');
var current=1;
var steps=[].slice.call(document.querySelectorAll('.inq-step'));
var progress=[].slice.call(document.querySelectorAll('.inq-progress span'));

function setStatus(message){var el=document.getElementById('inquiryStatus');if(el)el.textContent=message||'';}
function showStep(n){
 current=n;
 steps.forEach(function(step){var active=Number(step.dataset.step)===n;step.classList.toggle('is-active',active);step.setAttribute('aria-hidden',active?'false':'true');});
 progress.forEach(function(p,i){p.classList.toggle('is-active',i===n-1);p.classList.toggle('is-done',i<n-1);});
 setStatus('');
 window.scrollTo({top:0,behavior:'smooth'});
 var focus=steps[n-1].querySelector('input:not([type=radio]),select,textarea');
 if(focus)setTimeout(function(){focus.focus({preventScroll:true});},420);
}
form.addEventListener('click',function(e){
 var next=e.target.closest('[data-next]'),back=e.target.closest('[data-back]');
 if(next){
   if(current===1&&!form.querySelector('input[name="event_type"]:checked')){setStatus('Choose what you are inviting me to first.');return;}
   showStep(Number(next.dataset.next));
 }
 if(back)showStep(Number(back.dataset.back));
});
form.addEventListener('submit',function(e){
 e.preventDefault();
 var eventType=form.querySelector('input[name="event_type"]:checked'),name=form.elements.name,email=form.elements.email,gotcha=form.elements._gotcha;
 if(!eventType){showStep(1);setStatus('Choose what you are inviting me to first.');return}
 if(!name.value.trim()){name.focus();setStatus('Tell me who is getting in touch.');return}
 if(!email.checkValidity()){email.focus();setStatus('Please enter a valid email address.');return}
 if(gotcha&&gotcha.value)return;
 var data=new FormData(form),v=Object.fromEntries(data.entries());
 var subject='Booking enquiry — '+(v.event_type||'event');
 var body=['Name: '+(v.name||''),'Email: '+(v.email||''),'Event type: '+(v.event_type||''),'Date: '+(v.event_date||''),'Location: '+(v.location||''),'Duration: '+(v.duration||''),'','Message:',v.message||''].join('\n');
 document.body.classList.add('inq-sending');
 try{sessionStorage.setItem('ivar_booking_sent','1')}catch(_){}
 window.location.href='mailto:ivar.karm@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
 setTimeout(function(){document.body.classList.remove('inq-sending');if(success){success.classList.add('is-on');success.setAttribute('aria-hidden','false');if(road)road.setAttribute('aria-hidden','true');}},500);
});
window.addEventListener('pageshow',function(){document.body.classList.remove('inq-sending');});
})();