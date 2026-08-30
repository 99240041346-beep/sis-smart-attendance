const crypto=require('crypto');
/* Provider adapter. Production biometric decisions must come from a real liveness/face-match provider; never trust a browser boolean. Configure FACE_PROVIDER and its server credentials before enabling attendance. */
async function enroll({userId,imageBuffer,mimeType}){if(!process.env.FACE_PROVIDER)return {configured:false,status:'PENDING',message:'FACE_PROVIDER is not configured'};throw new Error('Provider adapter is not configured for the selected provider yet');}
async function verify({userId,imageBuffer,mimeType}){if(!process.env.FACE_PROVIDER)return {configured:false,pass:false,status:'FAIL',message:'FACE_PROVIDER is not configured'};throw new Error('Provider adapter is not configured for the selected provider yet');}
function verificationId(){return crypto.randomUUID()}
module.exports={enroll,verify,verificationId};
