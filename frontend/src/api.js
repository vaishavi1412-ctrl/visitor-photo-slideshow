// All communication with the backend goes through this file.

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('Cannot reach the server. Please check your connection and try again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // the server sent no JSON; handled below
  }

  if (!res.ok) {
    throw new Error(data?.error || 'Something went wrong. Please try again.');
  }
  return data;
}

function postJson(url, body) {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Uses XMLHttpRequest instead of fetch, because fetch cannot report upload progress.
function uploadPhotos(files, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('consent', 'true'); // the page only calls this after the consent box is ticked
    files.forEach((file) => form.append('photos', file));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/photos');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // not JSON
      }

      // The server answers with a result for every photo, even if all of them were rejected
      if (data?.results) {
        resolve(data);
        return;
      }
      reject(new Error(data?.error || 'Upload failed. Please try again.'));
    };

    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(form);
  });
}

export const api = {
  getMe: () => request('/api/visitors/me'),
  register: (fullName) => postJson('/api/visitors/register', { fullName }),
  loginReturning: (visitorCode, fullName) =>
    postJson('/api/visitors/login', { visitorCode, fullName }),
  logout: () => postJson('/api/visitors/logout', {}),

  getMyPhotos: () => request('/api/photos/mine'),
  deletePhoto: (id) => request(`/api/photos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  requestRemoval: (photoId, reason) => postJson('/api/removal-requests', { photoId, reason }),
  uploadPhotos,
};