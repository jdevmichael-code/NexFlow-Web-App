import bcrypt from 'bcryptjs'
import { z } from 'zod'

const BCRYPT_ROUNDS = 12

// bcrypt only uses the first 72 bytes, so we cap the length there
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number')

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS)

// Used when the username doesn't exist, so a wrong username takes as long
// as a wrong password (attackers can't tell which usernames are real by timing).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS)

export function checkPassword(password, hash) {
  return bcrypt.compare(password, hash || DUMMY_HASH)
}
