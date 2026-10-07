/* global emit */
// CouchDB views (map/reduce), saved to the database as the design doc "_design/nexflow".
// db.js saves them on startup whenever they change.
//
// These functions run INSIDE CouchDB, not in Node. CouchDB 2.0's JavaScript engine
// only understands old-style JavaScript (ES5): use `function` and `var`, no arrow
// functions, `let`/`const` or template strings.
//
// Mango indexes (db.js) handle "give me the newest N docs of X". Views are used for
// what Mango can't do quickly: counting, and looking inside arrays (members) or names.

export const DESIGN_NAME = 'nexflow'

const views = {
  // How many times each user did each action.
  // Query: startkey [userId], endkey [userId, {}], group: true
  // → rows like { key: [userId, 'sent_message'], value: 42 }
  activity_counts: {
    map: function (doc) {
      if (doc.type === 'activity') emit([doc.userId, doc.action], null)
    },
    reduce: '_count',
  },

  // One row per (member, room/channel), so "rooms I'm in" is a quick lookup.
  // Docs:   startkey [userId, 'room'], endkey [userId, 'room', {}], reduce: false, include_docs: true
  // Counts: startkey [userId], endkey [userId, {}], group_level: 2 → { key: [userId, 'room'], value: 3 }
  places_by_member: {
    map: function (doc) {
      if ((doc.type === 'room' || doc.type === 'channel') && doc.members) {
        for (var i = 0; i < doc.members.length; i++) {
          emit([doc.members[i], doc.type, doc.createdAt], null)
        }
      }
    },
    reduce: '_count',
  },

  // Search users by the start of their username or of any word in their display name.
  // Query: startkey 'ann', endkey 'ann' + (a very high character), include_docs: true — see searchUsers()
  users_by_name: {
    map: function (doc) {
      if (doc.type !== 'user' || doc.status === 'deleted') return
      var seen = {}
      var name = (doc.displayName || '').toLowerCase()
      var terms = [doc.username, name].concat(name.split(/\s+/))
      for (var i = 0; i < terms.length; i++) {
        if (terms[i] && !seen[terms[i]]) {
          seen[terms[i]] = true
          emit(terms[i], null)
        }
      }
    },
  },

  // All (not deleted) users by sign-up date, for the admin users table.
  // Query: descending: true, skip, limit, include_docs: true. `total_rows` = number of users.
  users_by_created: {
    map: function (doc) {
      if (doc.type === 'user' && doc.status !== 'deleted') emit(doc.createdAt, null)
    },
  },
}

// CouchDB stores the functions as text
export const DESIGN_DOC = {
  _id: `_design/${DESIGN_NAME}`,
  language: 'javascript',
  views: Object.fromEntries(
    Object.entries(views).map(([name, view]) => [
      name,
      view.reduce ? { map: view.map.toString(), reduce: view.reduce } : { map: view.map.toString() },
    ]),
  ),
}
