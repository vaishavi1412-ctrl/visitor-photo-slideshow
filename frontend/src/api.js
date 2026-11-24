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

export const api = {
  getMe: () => request('/api/visitors/me'),
  register: (fullName) => postJson('/api/visitors/register', { fullName }),
  loginReturning: (visitorCode, fullName) =>
    postJson('/api/visitors/login', { visitorCode, fullName }),
  logout: () => postJson('/api/visitors/logout', {}),
};