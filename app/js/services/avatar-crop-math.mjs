/** Aspect-cover rendering for a draggable square avatar crop. Pure and testable. */
export function avatarCropRect(sourceWidth,sourceHeight,boxSize,zoom=1,deltaX=0,deltaY=0) {
  if (![sourceWidth,sourceHeight,boxSize].every(v=>Number.isFinite(v)&&v>0))
    throw new Error('Invalid crop dimensions.');
  const z=Math.min(3,Math.max(1,Number(zoom)||1));
  const scale=Math.max(boxSize/sourceWidth,boxSize/sourceHeight)*z;
  const width=sourceWidth*scale,height=sourceHeight*scale;
  const maxX=Math.max(0,(width-boxSize)/2),maxY=Math.max(0,(height-boxSize)/2);
  const x=(boxSize-width)/2+Math.min(maxX,Math.max(-maxX,Number(deltaX)||0));
  const y=(boxSize-height)/2+Math.min(maxY,Math.max(-maxY,Number(deltaY)||0));
  return {x,y,width,height,zoom:z};
}
