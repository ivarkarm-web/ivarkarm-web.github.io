(function(){
'use strict';
var form=document.getElementById('inquiryForm');
var success=document.getElementById('inquirySuccess');
var road=document.getElementById('inqRoad');

function setStatus(message){
  var el=document.getElementById('inquiryStatus');
  if(el)el.textContent=message||'';
}

form.addEventListener('change',function(e){
  if(e.target&&e.target.name==='event_type'){
    setStatus('');
    form.classList.add('has-selection');
    var firstField=form.elements.name;
    setTimeout(function(){if(firstField)firstField.focus({preventScroll:true});},420);
  }
});

form.addEventListener('submit',function(e){
  e.preventDefault();
  var eventType=form.querySelector('input[name="event_type"]:checked');
  var name=form.elements.name;
  var email=form.elements.email;
  if(!eventType){setStatus('Choose what you are inviting me to first.');return}
  if(!name.value.trim()){name.focus();setStatus('Tell me who is getting in touch.');return}
  if(!email.checkValidity()){email.focus();setStatus('Please enter a valid email address.');return}
  var gotcha=form.elements._gotcha;
  if(gotcha&&gotcha.value)return;

  var data=new FormData(form),v=Object.fromEntries(data.entries());
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
  try{sessionStorage.setItem('ivar_booking_sent','1')}catch(_){}
  window.location.href='mailto:ivar.karm@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
  setTimeout(function(){
    document.body.classList.remove('inq-sending');
    if(success){
      success.classList.add('is-on');
      success.setAttribute('aria-hidden','false');
      if(road)road.setAttribute('aria-hidden','true');
    }
  },500);
});

window.addEventListener('pageshow',function(){
  document.body.classList.remove('inq-sending');
});
})();