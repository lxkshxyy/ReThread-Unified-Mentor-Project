import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 20000,
});

export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.error || (err?.code === 'ECONNABORTED' ? 'The server took too long to respond.' : err?.message) || fallback;
}

export function fieldErrors(err) {
  const details = err?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d) => [d.field, d.message]));
}

// Resize + compress an image in the browser before upload (max 1200px, JPEG ~80%).
export async function compressImage(file, max = 1200, quality = 0.8) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export async function uploadImage(file) {
  const compressed = await compressImage(file);
  const form = new FormData();
  form.append('image', compressed);
  const { data } = await api.post('/images', form);
  return data.url;
}
