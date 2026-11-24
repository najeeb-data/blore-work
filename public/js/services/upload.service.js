import { getFirebase } from '../firebase/firebase.service.js';
const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';

export async function uploadImage(file, folder) {
  const [{ app, auth }, storage] = await Promise.all([
    getFirebase(), 
    import(`${SDK}/firebase-storage.js`)
  ]);
  
  if (!auth.currentUser) throw new Error("Must be logged in to upload.");
  
  const storageInstance = storage.getStorage(app);
  const filename = `${folder}/${auth.currentUser.uid}_${Date.now()}.${file.name.split('.').pop()}`;
  const storageRef = storage.ref(storageInstance, filename);
  
  await storage.uploadBytes(storageRef, file);
  const downloadURL = await storage.getDownloadURL(storageRef);
  return downloadURL;
}
