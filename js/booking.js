/** Booking enquiry modal. Uses mailto by default; set BOOKING_ENDPOINT to a Formspree endpoint for background submission. */
const BOOKING_ENDPOINT = '';
(function(){
 const modal=document.getElementById('bookingModal'),open=document.getElementById('bookMeButton'),close=document.getElementById('bookingClose'),backdrop=document.getElementById('bookingModalBackdrop'),form=document.getElementById('bookingForm'),status=document.getElementById('bookingStatus');
 if(!modal||!open||!close||!form)return; let lastFocused=null;
 function setOpen(value){modal.classList.toggle('open',value);modal.setAttribute('aria-hidden',String(!value));document.body.classList.toggle('booking-open',value);if(value){lastFocused=document.activeElement;setTimeout(()=>form.querySelector('[name="name"]')?.focus(),80)}else{lastFocused?.focus?.()}}
 open.addEventListener('click',()=>setOpen(true));close.addEventListener('click',()=>setOpen(false));backdrop?.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))setOpen(false)});
 form.addEventListener('submit',async e=>{e.preventDefault();if(form.querySelector('[name="_gotcha"]')?.value)return;const data=new FormData(form),v=Object.fromEntries(data.entries());if(BOOKING_ENDPOINT){status.textContent='Sending…';try{const r=await fetch(BOOKING_ENDPOINT,{method:'POST',body:data,headers:{Accept:'application/json'}});if(!r.ok)throw Error();status.textContent='Enquiry sent. Thank you — I’ll get back to you soon.';form.reset();return}catch{status.textContent='Could not send automatically. Opening your email app instead…'}}
 const subject='Booking enquiry — '+(v.event_type||'event');const body=['Name: '+(v.name||''),'Email: '+(v.email||''),'Event type: '+(v.event_type||''),'Date: '+(v.event_date||''),'Location: '+(v.location||''),'Duration: '+(v.duration||''),'','Message:',v.message||''].join('\\n');window.location.href='mailto:ivar.karm@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
 });
})();
