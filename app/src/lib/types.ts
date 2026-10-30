export type ListingType = 'sale' | 'rent' | 'giveaway'
export type Status = 'active' | 'reserved' | 'sold' | 'removed'

export interface Profile {
  id: string
  email: string
  display_name: string
  batch: string | null
  role: 'student' | 'admin'
  status: 'pending' | 'approved' | 'suspended'
}

export interface Listing {
  id: string
  seller_id: string
  title: string
  description: string
  listing_type: ListingType
  category: string
  condition: string
  price_inr: number
  negotiable: boolean
  pickup_area: string | null
  rental_period: string | null
  deposit_inr: number | null
  photos: string[]
  status: Status
  created_at: string
  seller?: { display_name: string; batch: string | null } | null
}

export interface Conversation {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  created_at: string
  listing?: { title: string; photos: string[]; status: Status } | null
  buyer?: { display_name: string } | null
  seller?: { display_name: string } | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  image_path: string | null
  created_at: string
  read_at: string | null
}

export interface Offer {
  id: string
  conversation_id: string
  listing_id: string
  buyer_id: string
  amount_inr: number
  status: 'pending' | 'accepted' | 'declined'
}
