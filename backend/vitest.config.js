import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      DB_FILE: ':memory:',
      UPLOAD_DIR: path.join(os.tmpdir(), 'slideshow-test-uploads'),
    },
  },
});
