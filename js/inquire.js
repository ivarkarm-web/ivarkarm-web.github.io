(function(){
'use strict';
var form=document.getElementById('inquiryForm');
var steps=Array.prototype.slice.call(document.querySelectorAll('.inq-step'));
var success=document.getElementById('inquirySuccess');
var road=document.getElementById('inqRoad');
var returnBtn=document.getElementById('inquiryReturn');
var current=0;

function showStep(index, direction){
  if(index<0||index>=steps.length)return;
  steps.forEach(function(step,i){
    step.classList.toggle('is-active',i===index);
    step.setAttribute('aria-hidden',i===index?'false':'true');
  });
  current=index;
  window.scrollTo({top:0,behavior:'smooth'});
  var first=steps[index].querySelector('input:not([type="radio"]),select,textarea');
  if(index===0) first=steps[index].querySelector('input[type="radio"]');
  if(first) setTimeout(function(){try{first.focus({preventScroll:true})}catch(e){}},180);
}

function validateStep(index){
  var step=steps[index];
  if(!step)return false;
  if(index===0 && !form.querySelector('input[name="event_type"]:checked')){
    setStatus('Choose what you are inviting me to first.');
    return false;
  }
  if(index===2){
    var name=form.elements.name, email=form.elements.email;
    if(!name.value.trim()){name.focus();setStatus('Tell me who is getting in touch.');return false}
    if(!email.checkValidity()){email.focus();setStatus('Please enter a valid email address.');return false}
  }
  setStatus('');
  return true;
}

function setStatus(message){var el=document.getElementById('inquiryStatus');if(el)el.textContent=message||''}

document.querySelectorAll('[data-next]').forEach(function(btn){
  btn.addEventListener('click',function(){if(validateStep(current))showStep(current+1,1)});
});
document.querySelectorAll('[data-back]').forEach(function(btn){
  btn.addEventListener('click',function(){showStep(current-1,-1)});
});

form.addEventListener('submit',function(e){
  e.preventDefault();
  if(!validateStep(2))return;
  var gotcha=form.elements._gotcha;
  if(gotcha&&gotcha.value)return;

  var data=new FormData(form);
  var v=Object.fromEntries(data.entries());
  var subject='Booking enquiry — '+(v.event_type||'event');
  var body=[
    'Name: '+(v.name||''),
    'Email: '+(v.email||''),
    'Event type: '+(v.event_type||''),
    'Date: '+(v.event_date||''),
    'Location: '+(v.location||''),
    'Duration: '+(v.duration||''),
    '',
    'Message:',
    v.message||''
  ].join('\n');

  document.body.classList.add('inq-sending');
  var href='mailto:ivar.karm@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
  try{sessionStorage.setItem('ivar_booking_sent','1')}catch(_){}
  window.location.href=href;
  setTimeout(function(){
    document.body.classList.remove('inq-sending');
    success.classList.add('is-on');
    success.setAttribute('aria-hidden','false');
    if(road)road.setAttribute('aria-hidden','true');
  },500);
});

function returnToRoad(){
  window.location.href='./index.html';
}
if(returnBtn)returnBtn.addEventListener('click',returnToRoad);

window.addEventListener('pageshow',function(){
  document.body.classList.remove('inq-sending');
});
})();