// Create an admin account, or turn an existing user into an admin.
// Usage: npm run create-admin -- <username> <password> [display name]

import { connectDb, getDoc, saveDoc, updateDoc } from '../db.js'
import { hashPassword, passwordSchema } from '../utils/passwords.js'
import { newUser, userIdFor, usernameSchema } from '../utils/users.js'

const [usernameArg, password, ...nameParts] = process.argv.slice(2)

if (!usernameArg || !password) {
  console.log('Usage: npm run create-admin -- <username> <password> [display name]')
  process.exit(1)
}

const username = usernameSchema.safeParse(usernameArg)
const strongPassword = passwordSchema.safeParse(password)
if (!username.success) exit(username.error.issues[0].message)
if (!strongPassword.success) exit(strongPassword.error.issues[0].message)

await connectDb()

const passwordHash = await hashPassword(password)
const existing = await getDoc(userIdFor(username.data))

if (existing) {
  await updateDoc(existing._id, (doc) => {
    doc.role = 'admin'
    doc.status = 'active'
    doc.passwordHash = passwordHash
    doc.tokenVersion += 1
    doc.failedLogins = 0
    doc.lockedUntil = null
  })
  console.log(`"${username.data}" is now an admin (password updated).`)
} else {
  const displayName = nameParts.join(' ') || username.data
  await saveDoc(newUser({ username: username.data, displayName, passwordHash, role: 'admin' }))
  console.log(`Admin "${username.data}" created.`)
}

function exit(message) {
  console.error(message)
  process.exit(1)
}
