import { validatePhotoSource } from './profile-photo-policy.mjs';
import { avatarCropRect } from './avatar-crop-math.mjs';

/**
 * Interactive, keyboard-accessible avatar crop preview.
 * It never uploads; photo submission is delegated to the server callable.
 */
export async function mountAvatarCropper(file,host) {
  validatePhotoSource(file); // Must precede image decoding.
  const image=await createImageBitmap(file,{imageOrientation:'from-image'});
  if(!image.width||!image.height||image.width*image.height>32000000){
    image.close?.();
    throw new Error('Image dimensions are too large for safe cropping.');
  }
  const SIZE=220,OUTPUT=1024;
  let zoom=1,offsetX=0,offsetY=0,dragging=false,lastX=0,lastY=0,disposed=false;
  const editor=document.createElement('div');
  editor.className='tefsen-avatar-crop';
  editor.innerHTML=`<canvas width="${SIZE}" height="${SIZE}" tabindex="0" role="img"
    aria-label="Drag photo to position it in the circular avatar guide; arrow keys also reposition the photo"></canvas>
    <label>Zoom <input type="range" min="1" max="3" step=".01" value="1" aria-label="Zoom avatar photo"></label>
    <button type="button" class="social-secondary" data-avatar-crop-reset>Reset position</button>
    <small>Drag to position. Zoom for the best crop. Only the square image is uploaded; the app displays it as a circle.</small>`;
  const canvas=editor.querySelector('canvas');
  const slider=editor.querySelector('input');
  const reset=editor.querySelector('button');
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx){image.close?.();throw new Error('Canvas photo cropping is not available.');}
  function drawTo(target,size){
    const {x,y,width,height}=avatarCropRect(image.width,image.height,size,zoom,offsetX*size/SIZE,offsetY*size/SIZE);
    target.fillStyle='#111';target.fillRect(0,0,size,size);
    target.drawImage(image,x,y,width,height);
  }
  function paint(){
    if(disposed)return;
    ctx.clearRect(0,0,SIZE,SIZE);
    drawTo(ctx,SIZE);
    // Non-destructive circular guide; JPEG remains a usable square avatar.
    ctx.strokeStyle='rgba(255,255,255,.92)';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(SIZE/2,SIZE/2,SIZE/2-4,0,Math.PI*2);
    ctx.stroke();
  }
  function moveBy(x,y){offsetX+=x;offsetY+=y;paint();}
  canvas.addEventListener('pointerdown',e=>{
    dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!dragging)return;
    moveBy(e.clientX-lastX,e.clientY-lastY);
    lastX=e.clientX;lastY=e.clientY;
  });
  canvas.addEventListener('pointerup',()=>{dragging=false;});
  canvas.addEventListener('pointercancel',()=>{dragging=false;});
  canvas.addEventListener('keydown',e=>{
    const dx=({ArrowLeft:-6,ArrowRight:6})[e.key]||0;
    const dy=({ArrowUp:-6,ArrowDown:6})[e.key]||0;
    if(dx||dy){e.preventDefault();moveBy(dx,dy);}
  });
  slider.addEventListener('input',()=>{
    zoom=Number(slider.value)||1;
    paint();
  });
  reset.addEventListener('click',()=>{
    zoom=1;offsetX=0;offsetY=0;slider.value='1';paint();canvas.focus();
  });
  host.replaceChildren(editor);
  paint();
  return {
    async toFile(){
      if(disposed)throw new Error('Photo crop is no longer available.');
      const output=document.createElement('canvas');
      output.width=OUTPUT;output.height=OUTPUT;
      const out=output.getContext('2d',{alpha:false});
      if(!out)throw new Error('Could not export the avatar.');
      drawTo(out,OUTPUT);
      const blob=await new Promise(resolve=>output.toBlob(resolve,'image/jpeg',.86));
      if(!blob)throw new Error('Photo export failed.');
      return new File([blob],'tefsen-profile-photo.jpg',{type:'image/jpeg'});
    },
    dispose(){if(!disposed){disposed=true;image.close?.();}}
  };
}
