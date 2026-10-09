/** Inventory categories. Must match CATEGORIES in server/src/routes/items.js */
export const ITEM_CATEGORIES = {
  place: { label: 'Place', icon: '📍', whereLabel: 'Location' },
  movie: { label: 'Movie', icon: '🎬', whereLabel: 'Where to watch' },
  series: { label: 'Series', icon: '📺', whereLabel: 'Where to watch' },
  book: { label: 'Book', icon: '📚', whereLabel: 'Where to get it' },
  game: { label: 'Game', icon: '🎮', whereLabel: 'Platform' },
  other: { label: 'Other', icon: '✨', whereLabel: 'Where' },
}

/** The category of an item, with a safe fallback for unknown ones. */
export const categoryOf = (item) => ITEM_CATEGORIES[item?.category] || ITEM_CATEGORIES.other
