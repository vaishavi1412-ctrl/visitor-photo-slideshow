// Checks and cleans a visitor's name.
// Returns { value } when the name is fine, or { error } when it is not.
export function cleanName(input) {
  if (typeof input !== 'string') {
    return { error: 'Please enter your full name.' };
  }

  const name = input.trim().replace(/\s+/g, ' ');

  if (name.length < 2 || name.length > 60) {
    return { error: 'Name must be between 2 and 60 characters.' };
  }

  // Letters (any language), spaces, dots, apostrophes and hyphens only
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u.test(name)) {
    return { error: 'Name can only contain letters, spaces, dots, apostrophes and hyphens.' };
  }

  return { value: name };
}