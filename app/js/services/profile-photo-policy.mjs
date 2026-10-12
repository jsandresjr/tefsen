export const MAX_PROFILE_SOURCE_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES=new Set(['image/jpeg','image/png','image/webp']);

/** Rejects oversized/unknown sources before any image decode or crop. */
export function validatePhotoSource(file) {
  if(!file || !Number.isFinite(file.size) || file.size < 1 || file.size > MAX_PROFILE_SOURCE_BYTES)
    throw new Error('Select an image smaller than or equal to 5 MB.');
  if(!PHOTO_TYPES.has(String(file.type||'').toLowerCase()))
    throw new Error('Choose a JPG, PNG or WebP image.');
  return true;
}
