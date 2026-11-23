import bcrypt from 'bcryptjs';
import db from '../db.js';

// Makes the single admin account match the values in backend/.env.
// Only a hash of the password is ever stored in the database.
export function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password || password.length < 8 || password.startsWith('replace-with')) {
    console.warn(
      'No admin account was set up. Put ADMIN_USERNAME and an ADMIN_PASSWORD ' +
        '(8+ characters) in backend/.env and restart the backend.'
    );
    return;
  }

  const existing = db
    .prepare('SELECT admin_id, username, password_hash FROM admin ORDER BY admin_id LIMIT 1')
    .get();

  if (!existing) {
    db.prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run(
      username,
      bcrypt.hashSync(password, 10)
    );
    console.log(`Admin account "${username}" created.`);
  } else if (existing.username !== username || !bcrypt.compareSync(password, existing.password_hash)) {
    db.prepare('UPDATE admin SET username = ?, password_hash = ? WHERE admin_id = ?').run(
      username,
      bcrypt.hashSync(password, 10),
      existing.admin_id
    );
    console.log(`Admin account "${username}" updated from .env.`);
  }
}