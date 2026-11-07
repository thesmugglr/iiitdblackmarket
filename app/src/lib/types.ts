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
  expires_at?: string
  seller?: { display_name: string; batch: string | null } | null
}

export interface Conversation {
  id: string
  listing_id: string | null
  buyer_id: string
  seller_id: string
  created_at: string
  /** 'direct' chats start when someone sends a listing to a friend; buyer_id started it, seller_id received it. */
  kind?: 'listing' | 'direct'
  request_status?: 'pending' | 'accepted' | 'declined'
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
  shared_listing_id?: string | null
  reply_to_id?: string | null
  created_at: string
  read_at: string | null
}

export const REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥'] as const
export type ReactionEmoji = typeof REACTIONS[number]
export interface Reaction { message_id: string; user_id: string; conversation_id: string; emoji: ReactionEmoji | null }

export interface Offer {
  id: string
  conversation_id: string
  listing_id: string
  buyer_id: string
  amount_inr: number
  status: 'pending' | 'accepted' | 'declined'
}

export interface Notice { id: string; kind: 'message' | 'wanted' | 'expiry' | 'approval' | 'price_drop' | 'saved_sold' | 'lost_found'; title: string; link: string | null; read_at: string | null; created_at: string }
export interface Deal { id: string; listing_id: string | null; conversation_id: string | null; seller_id: string; buyer_id: string | null; title: string; amount_inr: number | null; smooth: boolean | null; created_at: string }
export interface LostFoundPost { id: string; user_id: string; kind: 'lost' | 'found'; title: string; description: string; place: string | null; photo: string | null; status: 'open' | 'resolved'; created_at: string; poster?: { display_name: string } | null }
export interface LostFoundReply { id: string; post_id: string; sender_id: string; recipient_id: string; body: string; created_at: string }
export interface Wanted { id: string; user_id: string; title: string; description: string; category: string; max_price_inr: number | null; status: 'open' | 'fulfilled' | 'closed'; created_at: string; poster?: { display_name: string } | null }
export interface Bundle { id: string; seller_id: string; title: string; description: string; price_inr: number; status: 'active' | 'sold' | 'removed'; created_at: string; seller?: { display_name: string } | null; items?: { listing: Listing | null }[] }
