export const CATEGORIES: Record<string, string> = {
  electronics: 'Electronics',
  books: 'Books & course materials',
  hostel: 'Hostel essentials',
  furniture: 'Furniture',
  cycles: 'Cycles',
  clothing: 'Clothing',
  sports: 'Sports & gaming',
  misc: 'Miscellaneous',
}
export const CONDITIONS: Record<string, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
}
export const TYPES: Record<string, string> = { sale: 'Sale', rent: 'Rent', giveaway: 'Giveaway' }
export const MAX_PHOTOS = 6
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN')
