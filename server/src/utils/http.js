/** An error with an HTTP status. The error handler sends `message` to the client. */
export function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

/** Check `data` against a zod schema. Throws a 400 error with a readable message if it fails. */
export function validate(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    const field = issue.path.join('.')
    throw httpError(400, field ? `${field}: ${issue.message}` : issue.message)
  }
  return result.data
}
