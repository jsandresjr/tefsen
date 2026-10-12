import { firebaseApp } from '../firebase-client.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

import { validatePhotoSource } from './profile-photo-policy.mjs';

function readDataUrl(blob) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Could not read the selected photo.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Reduce outgoing image bytes. Browsers honor EXIF orientation when decoding
 * with createImageBitmap({imageOrientation:'from-image'}).
 */
export async function preparePhotoBase64(file) {
  validatePhotoSource(file);
  let bitmap;
  try{
    bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
    if(!bitmap.width || !bitmap.height || bitmap.width*bitmap.height>32000000)
      throw new Error('Photo dimensions are too large. Choose another image.');
    const side=Math.min(bitmap.width,bitmap.height);
    const scale=Math.min(1,1024/side);
    const outputSide=Math.max(1,Math.round(side*scale));
    const canvas=document.createElement('canvas');
    canvas.width=outputSide;
    canvas.height=outputSide;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Photo processing is unavailable on this browser.');
    const sx=Math.round((bitmap.width-side)/2),sy=Math.round((bitmap.height-side)/2);
    ctx.drawImage(bitmap,sx,sy,side,side,0,0,outputSide,outputSide);
    const jpeg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));
    if(!jpeg)throw new Error('Could not prepare the photo.');
    const data=await readDataUrl(jpeg);
    return data.substring(data.indexOf(',')+1);
  } finally {
    bitmap?.close?.();
  }
}

/** Backend owns quota, timestamp, profile write, and all Storage mutations. */
export async function updateProfilePhoto(action,imageBase64='') {
  if(!firebaseApp)throw new Error('Firebase is not connected.');
  if(!['upload','remove'].includes(action))throw new Error('Invalid photo action.');
  const callable=httpsCallable(getFunctions(firebaseApp,'us-central1'),'updateProfilePhoto');
  const response=await callable(action==='upload'?{action,imageBase64}:{action});
  const result=response.data || {};
  if(typeof result!=='object' || !Object.prototype.hasOwnProperty.call(result,'profileImageUrl'))
    throw new Error('The photo service returned an incomplete response.');
  return result;
}
