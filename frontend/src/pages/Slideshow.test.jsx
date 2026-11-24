import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// A fake live connection: the tests trigger the "photos:updated" message by hand
const socketMock = vi.hoisted(() => {
  const handlers = {};
  return {
    handlers,
    socket: {
      on: (event, fn) => {
        handlers[event] = fn;
      },
      disconnect: () => {},
    },
  };
});

vi.mock('socket.io-client', () => ({ io: () => socketMock.socket }));

import Slideshow from './Slideshow.jsx';

let payload;

function makePhoto(letter) {
  return { id: `id-${letter}`, url: `/uploads/${letter}.webp` };
}

function setPhotos(...letters) {
  payload = {
    photos: letters.map(makePhoto),
    settings: { photoDuration: 5, transitionType: 'fade' },
  };
}

// Moves the fake clock forward and lets React finish updating
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function openSlideshow() {
  const view = render(
    <MemoryRouter>
      <Slideshow />
    </MemoryRouter>
  );
  await flush(0);
  return view;
}

const count = () => screen.getByTestId('count').textContent;
const currentSrc = () =>
  document.querySelector('.slide.is-entering .fg')?.getAttribute('src');

beforeEach(() => {
  vi.useFakeTimers();
  setPhotos('a', 'b', 'c');
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => payload }));
  Object.keys(socketMock.handlers).forEach((key) => delete socketMock.handlers[key]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Slideshow page', () => {
  it('shows a friendly empty screen when there are no photos', async () => {
    setPhotos();
    await openSlideshow();
    expect(screen.getByText('Be the first on the big screen')).toBeTruthy();
    expect(count()).toBe('No photos yet');
  });

  it('shows the first photo, the counter and the settings', async () => {
    await openSlideshow();
    expect(currentSrc()).toBe('/uploads/a.webp');
    expect(count()).toBe('Photo 1 of 3');
    expect(screen.getByText('5 seconds per photo, fade transition')).toBeTruthy();
  });

  it('moves to the next photo automatically after the photo duration', async () => {
    await openSlideshow();
    expect(count()).toBe('Photo 1 of 3');

    await flush(4000);
    expect(count()).toBe('Photo 1 of 3'); // 4 seconds: still the first photo

    await flush(1000);
    expect(count()).toBe('Photo 2 of 3'); // 5 seconds: next photo
    expect(currentSrc()).toBe('/uploads/b.webp');
  });

  it('goes back to the first photo after the last one', async () => {
    await openSlideshow();
    await flush(5000);
    await flush(5000);
    expect(count()).toBe('Photo 3 of 3');
    await flush(5000);
    expect(count()).toBe('Photo 1 of 3');
  });

  it('stops moving while paused and continues after Play', async () => {
    await openSlideshow();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await flush(0);

    await flush(12000);
    expect(count()).toBe('Photo 1 of 3'); // nothing moved while paused
    expect(screen.getByText('Paused')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush(0);
    await flush(5000);
    expect(count()).toBe('Photo 2 of 3');
  });

  it('Next and Previous buttons change the photo', async () => {
    await openSlideshow();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await flush(0);
    expect(count()).toBe('Photo 2 of 3');

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await flush(0);
    expect(count()).toBe('Photo 1 of 3');
  });

  it('jumps to a photo when its thumbnail is clicked', async () => {
    await openSlideshow();
    fireEvent.click(screen.getByLabelText('Show photo 3'));
    await flush(0);
    expect(currentSrc()).toBe('/uploads/c.webp');
    expect(count()).toBe('Photo 3 of 3');
  });

  it('shows a newly uploaded photo at the next change, not at the end of the list', async () => {
    await openSlideshow();
    expect(count()).toBe('Photo 1 of 3');

    // someone uploads photo "d": the server announces it and the page reloads the list
    setPhotos('a', 'b', 'c', 'd');
    await act(async () => {
      socketMock.handlers['photos:updated']();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(count()).toBe('Photo 1 of 4');

    await flush(5000);
    expect(currentSrc()).toBe('/uploads/d.webp'); // the new photo came next
    expect(count()).toBe('Photo 4 of 4');
  });

  it('removes a photo from the slideshow when the server deletes it', async () => {
    await openSlideshow();
    setPhotos('b', 'c');
    await act(async () => {
      socketMock.handlers['photos:updated']();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(count()).toBe('Photo 1 of 2');
    expect(currentSrc()).toBe('/uploads/b.webp');
  });

  it('drops a photo whose image fails to load, so no broken image is shown', async () => {
    setPhotos('a', 'b');
    await openSlideshow();
    fireEvent.error(document.querySelector('.slide.is-entering .fg'));
    await flush(0);
    expect(count()).toBe('Photo 1 of 1');
    expect(currentSrc()).toBe('/uploads/b.webp');
  });

  it('shows a clear message when the server cannot be reached', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    await openSlideshow();
    expect(screen.getByText(/reach the server/i)).toBeTruthy();
  });
});