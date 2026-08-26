let attendanceToken="";
let studentLat=null, studentLon=null;

function getLocation(callback){
  if(!navigator.geolocation){alert("Geolocation is not supported.");return;}
  navigator.geolocation.getCurrentPosition(
    p=>{
      studentLat=p.coords.latitude; studentLon=p.coords.longitude;
      const a=document.getElementById("locStatus"); if(a)a.textContent=`Location captured: ${studentLat.toFixed(6)}, ${studentLon.toFixed(6)}`;
      const f1=document.getElementById("flat"), f2=document.getElementById("flon");
      if(f1)f1.value=studentLat;if(f2)f2.value=studentLon;
      if(callback)callback();
      fetch("/api/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({latitude:studentLat,longitude:studentLon})}).catch(()=>{});
    },
    e=>alert("Location permission is required: "+e.message),
    {enableHighAccuracy:true,timeout:10000,maximumAge:0}
  );
}
function startAttendance(){
  attendanceToken=document.getElementById("token").value.trim();
  if(!attendanceToken){alert("Enter the QR attendance token.");return;}
  document.getElementById("verify").classList.remove("hidden");
  getLocation();
}
function submitAttendance(){
  if(!studentLat){getLocation(submitAttendance);return;}
  if(!document.getElementById("face").checked){alert("Complete the face verification step.");return;}
  const form=document.createElement("form"); form.method="POST"; form.action="/attendance/"+encodeURIComponent(attendanceToken);
  [["latitude",studentLat],["longitude",studentLon],["face_verified","1"]].forEach(([n,v])=>{let i=document.createElement("input");i.type="hidden";i.name=n;i.value=v;form.appendChild(i)});
  document.body.appendChild(form);form.submit();
}
function facultySession(e){
  if(!document.getElementById("flat").value){e.preventDefault();getLocation(()=>e.target.submit());return false}
  return true;
}
