import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.jsx';

// Helpers that describe what the fake server answers
const ok = (body) => ({ status: 200, body });
const fail = (status, error) => ({ status, body: { error } });

let calls;

// Replaces fetch: every request is recorded, and the answer comes from the "routes" table
function mockApi(routes) {
  calls = [];
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    calls.push({ url, method, body: options.body ? JSON.parse(options.body) : undefined });
    const result = routes[`${method} ${url}`] || fail(404, `No mock for ${method} ${url}`);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.body,
    };
  });
}

const called = (method, url) => calls.find((c) => c.method === method && c.url === url);

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

// Sample data
const stats = {
  totalVisitors: 3,
  totalPhotos: 7,
  onSlideshow: 5,
  pendingRemovalRequests: 1,
  recentVisitors: [
    { id: 2, fullName: 'Asha Patel', createdAt: '2026-11-24 10:00:00', photoCount: 4 },
    { id: 1, fullName: 'Ravi Shah', createdAt: '2026-11-23 09:00:00', photoCount: 1 },
  ],
};

const photos = [
  {
    id: 'p1',
    url: '/uploads/p1.webp',
    uploadDate: '2026-11-24 10:05:00',
    consent: true,
    displayStatus: 'visible',
    visitorId: 2,
    visitorName: 'Asha Patel',
  },
  {
    id: 'p2',
    url: '/uploads/p2.webp',
    uploadDate: '2026-11-23 09:05:00',
    consent: true,
    displayStatus: 'hidden',
    visitorId: 1,
    visitorName: 'Ravi Shah',
  },
];

const requests = [
  {
    id: 11,
    photoId: 'p1',
    reason: 'Please remove it',
    status: 'pending',
    createdAt: '2026-11-24 11:00:00',
    visitorName: 'Asha Patel',
    url: '/uploads/p1.webp',
  },
];

// Answers for a signed-in admin
function loggedIn(extra = {}) {
  return {
    'GET /api/admin/me': ok({ admin: { username: 'admin' } }),
    'GET /api/admin/stats': ok(stats),
    'GET /api/admin/photos': ok({ photos }),
    'GET /api/admin/removal-requests': ok({ requests }),
    'GET /api/admin/visitors': ok({ visitors: stats.recentVisitors }),
    'GET /api/admin/settings': ok({
      settings: { photoDuration: 5, transitionType: 'fade' },
      limits: { minDuration: 2, maxDuration: 60, transitions: ['fade', 'slide', 'zoom'] },
    }),
    ...extra,
  };
}

beforeEach(() => {
  window.confirm = vi.fn(() => true);
});

afterEach(() => {
  cleanup();
});

describe('Admin sign in and protection', () => {
  it('sends a visitor who is not signed in to the login page', async () => {
    mockApi({ 'GET /api/admin/me': ok({ admin: null }) });
    renderAt('/admin/photos');

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
    expect(called('GET', '/api/admin/photos')).toBeUndefined(); // the protected data was never requested
  });

  it('shows an error for a wrong password', async () => {
    mockApi({
      'GET /api/admin/me': ok({ admin: null }),
      'POST /api/admin/login': fail(401, 'Wrong username or password.'),
    });
    renderAt('/admin/login');

    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Wrong username or password.')).toBeTruthy();
    expect(called('POST', '/api/admin/login').body).toEqual({ username: 'admin', password: 'nope' });
  });

  it('opens the dashboard after a correct login', async () => {
    mockApi(
      loggedIn({
        'GET /api/admin/me': ok({ admin: null }),
        'POST /api/admin/login': ok({ admin: { username: 'admin' } }),
      })
    );
    renderAt('/admin/login');

    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByTestId('stat-visitors')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
  });

  it('goes back to the login page when the session has ended', async () => {
    mockApi(loggedIn({ 'GET /api/admin/stats': fail(401, 'Admin login required.') }));
    renderAt('/admin');

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
  });

  it('signs out and returns to the login page', async () => {
    mockApi(loggedIn({ 'POST /api/admin/logout': ok({ ok: true }) }));
    renderAt('/admin');

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
    expect(called('POST', '/api/admin/logout')).toBeTruthy();
  });
});

describe('Admin dashboard', () => {
  it('shows the totals and the recent visitors', async () => {
    mockApi(loggedIn());
    renderAt('/admin');

    expect((await screen.findByTestId('stat-visitors')).textContent).toBe('3');
    expect(screen.getByTestId('stat-photos').textContent).toBe('7');
    expect(screen.getByTestId('stat-slideshow').textContent).toBe('5');
    expect(screen.getByTestId('stat-requests').textContent).toBe('1');
    expect(screen.getByText('Asha Patel')).toBeTruthy();
    expect(screen.getByText('Ravi Shah')).toBeTruthy();
  });
});

describe('Admin photos and removal requests', () => {
  it('hides a photo from the slideshow', async () => {
    mockApi(loggedIn({ 'PATCH /api/admin/photos/p1': ok({ ok: true }) }));
    renderAt('/admin/photos');

    fireEvent.click(await screen.findByRole('button', { name: 'Hide photo by Asha Patel' }));

    expect(await screen.findByText('Photo hidden from the slideshow.')).toBeTruthy();
    expect(called('PATCH', '/api/admin/photos/p1').body).toEqual({ displayStatus: 'hidden' });
  });

  it('shows a hidden photo on the slideshow again', async () => {
    mockApi(loggedIn({ 'PATCH /api/admin/photos/p2': ok({ ok: true }) }));
    renderAt('/admin/photos');

    fireEvent.click(await screen.findByRole('button', { name: 'Show photo by Ravi Shah' }));

    expect(await screen.findByText('Photo is back on the slideshow.')).toBeTruthy();
    expect(called('PATCH', '/api/admin/photos/p2').body).toEqual({ displayStatus: 'visible' });
  });

  it('deletes a photo after the admin confirms', async () => {
    mockApi(loggedIn({ 'DELETE /api/admin/photos/p1': ok({ ok: true }) }));
    renderAt('/admin/photos');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo by Asha Patel' }));

    expect(await screen.findByText('Photo deleted.')).toBeTruthy();
    expect(window.confirm).toHaveBeenCalled();
    expect(called('DELETE', '/api/admin/photos/p1')).toBeTruthy();
  });

  it('does not delete a photo when the admin cancels', async () => {
    window.confirm = vi.fn(() => false);
    mockApi(loggedIn());
    renderAt('/admin/photos');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo by Asha Patel' }));

    expect(window.confirm).toHaveBeenCalled();
    expect(called('DELETE', '/api/admin/photos/p1')).toBeUndefined();
  });

  it('approves a removal request', async () => {
    mockApi(loggedIn({ 'PATCH /api/admin/removal-requests/11': ok({ ok: true }) }));
    renderAt('/admin/photos');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Approve removal request from Asha Patel' })
    );

    expect(await screen.findByText(/Request approved/)).toBeTruthy();
    expect(called('PATCH', '/api/admin/removal-requests/11').body).toEqual({ status: 'approved' });
  });

  it('rejects a removal request', async () => {
    mockApi(loggedIn({ 'PATCH /api/admin/removal-requests/11': ok({ ok: true }) }));
    renderAt('/admin/photos');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Reject removal request from Asha Patel' })
    );

    expect(await screen.findByText(/Request rejected/)).toBeTruthy();
    expect(called('PATCH', '/api/admin/removal-requests/11').body).toEqual({ status: 'rejected' });
  });
});

describe('Admin slideshow settings', () => {
  it('shows the current settings and saves new ones', async () => {
    mockApi(
      loggedIn({
        'PUT /api/admin/settings': ok({ settings: { photoDuration: 8, transitionType: 'zoom' } }),
      })
    );
    renderAt('/admin/settings');

    const duration = await screen.findByLabelText('Seconds per photo');
    expect(duration.value).toBe('5');
    expect(screen.getByLabelText(/^Fade/).checked).toBe(true);

    fireEvent.change(duration, { target: { value: '8' } });
    fireEvent.click(screen.getByLabelText(/^Zoom/));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByText(/Settings saved/)).toBeTruthy();
    expect(called('PUT', '/api/admin/settings').body).toEqual({
      photoDuration: 8,
      transitionType: 'zoom',
    });
  });

  it('refuses an invalid duration without calling the server', async () => {
    mockApi(loggedIn());
    renderAt('/admin/settings');

    const duration = await screen.findByLabelText('Seconds per photo');
    fireEvent.change(duration, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(
      await screen.findByText('Choose a whole number of seconds from 2 to 60.')
    ).toBeTruthy();
    expect(called('PUT', '/api/admin/settings')).toBeUndefined();
  });
});

describe('Admin visitor management', () => {
  it('renames a visitor', async () => {
    mockApi(loggedIn({ 'PATCH /api/admin/visitors/2': ok({ ok: true }) }));
    renderAt('/admin/visitors');

    fireEvent.click(await screen.findByRole('button', { name: 'Rename Asha Patel' }));
    fireEvent.change(screen.getByLabelText('New name for Asha Patel'), {
      target: { value: 'Asha Shah' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save new name for Asha Patel' }));

    expect(await screen.findByText('Name updated.')).toBeTruthy();
    expect(called('PATCH', '/api/admin/visitors/2').body).toEqual({ fullName: 'Asha Shah' });
  });

  it('deletes a visitor after the admin confirms, and warns about their photos', async () => {
    mockApi(loggedIn({ 'DELETE /api/admin/visitors/2': ok({ ok: true }) }));
    renderAt('/admin/visitors');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Asha Patel' }));

    expect(await screen.findByText('Visitor deleted.')).toBeTruthy();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('4 photos'));
    expect(called('DELETE', '/api/admin/visitors/2')).toBeTruthy();
  });

  it('does not delete a visitor when the admin cancels', async () => {
    window.confirm = vi.fn(() => false);
    mockApi(loggedIn());
    renderAt('/admin/visitors');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Asha Patel' }));

    expect(called('DELETE', '/api/admin/visitors/2')).toBeUndefined();
  });
});