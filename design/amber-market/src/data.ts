export type ListingKind = "Buy" | "Rent" | "Free";
export type Category =
  | "All finds"
  | "Electronics"
  | "Books & notes"
  | "Room essentials"
  | "Cycles & sports"
  | "Just for fun";
export interface Listing {
  id: number;
  title: string;
  category: Category;
  kind: ListingKind;
  price: number;
  image: string;
  seller: string;
  initials: string;
  batch: string;
  condition: "Like new" | "Good" | "Well loved";
  location: string;
  badge?: string;
  description: string;
  rating: string;
}
export const categories: Category[] = [
  "All finds",
  "Electronics",
  "Books & notes",
  "Room essentials",
  "Cycles & sports",
  "Just for fun",
];
export const listings: Listing[] = [
  {
    id: 1,
    title: "Your new everyday headphones",
    category: "Electronics",
    kind: "Buy",
    price: 2400,
    image: "headphones",
    seller: "Aarav M.",
    initials: "AM",
    batch: "Class of ’27",
    condition: "Like new",
    location: "Hostel lobby",
    badge: "A good find",
    rating: "4.9",
    description:
      "Good music deserves good company. A comfortable wireless pair for library sessions and long walks. Illustration only — this is a sample listing.",
  },
  {
    id: 2,
    title: "A little room, a lot more cosy",
    category: "Room essentials",
    kind: "Buy",
    price: 750,
    image: "lamp",
    seller: "Ishita R.",
    initials: "IR",
    batch: "Class of ’26",
    condition: "Good",
    location: "Hostel lobby",
    rating: "4.8",
    description:
      "A warm reading lamp to make late-night study sessions feel a little softer. Illustration only — this is a sample listing.",
  },
  {
    id: 3,
    title: "Stories with a second chapter",
    category: "Books & notes",
    kind: "Buy",
    price: 450,
    image: "books",
    seller: "Kabir N.",
    initials: "KN",
    batch: "Class of ’28",
    condition: "Well loved",
    location: "Library",
    badge: "Pass it on",
    rating: "4.9",
    description:
      "A small stack of well-loved reads, ready for the next bedside table. Illustration only — this is a sample listing.",
  },
  {
    id: 4,
    title: "A camera for the weekend",
    category: "Electronics",
    kind: "Rent",
    price: 800,
    image: "camera",
    seller: "Meera S.",
    initials: "MS",
    batch: "Class of ’27",
    condition: "Like new",
    location: "Academic block",
    rating: "4.9",
    description:
      "Borrow a little perspective for a campus walk or a weekend photo project. Sample rental price is per day; this is not an available item.",
  },
  {
    id: 5,
    title: "A leafy little roommate",
    category: "Room essentials",
    kind: "Free",
    price: 0,
    image: "plant",
    seller: "Dev A.",
    initials: "DA",
    batch: "Class of ’26",
    condition: "Good",
    location: "Hostel lobby",
    badge: "Free to a good room",
    rating: "4.8",
    description:
      "A little green for your desk. A sample giveaway to show how passing things on could look.",
  },
  {
    id: 6,
    title: "Take the scenic route",
    category: "Cycles & sports",
    kind: "Buy",
    price: 4500,
    image: "cycle",
    seller: "Riya K.",
    initials: "RK",
    batch: "Class of ’27",
    condition: "Good",
    location: "Sports complex",
    rating: "4.9",
    description:
      "A city cycle for the ride to class and everywhere after it. Illustration only — this is a sample listing.",
  },
  {
    id: 7,
    title: "A keyboard with character",
    category: "Electronics",
    kind: "Buy",
    price: 1200,
    image: "keyboard",
    seller: "Arjun P.",
    initials: "AP",
    batch: "Class of ’28",
    condition: "Like new",
    location: "Library",
    rating: "4.8",
    description:
      "Make your desk feel a little more like yours. Illustration only — this is a sample listing.",
  },
  {
    id: 8,
    title: "Game night, sorted",
    category: "Just for fun",
    kind: "Rent",
    price: 250,
    image: "controller",
    seller: "Sana V.",
    initials: "SV",
    batch: "Class of ’27",
    condition: "Good",
    location: "Hostel lobby",
    rating: "4.9",
    description:
      "A sample controller rental for unwinding with friends. Sample price is per day; no real rental is offered.",
  },
  {
    id: 9,
    title: "Numbers, meet your match",
    category: "Electronics",
    kind: "Buy",
    price: 600,
    image: "calculator",
    seller: "Nikhil D.",
    initials: "ND",
    batch: "Class of ’26",
    condition: "Good",
    location: "Academic block",
    rating: "4.8",
    description:
      "A trusty calculator looking for its next problem to solve. Illustration only — this is a sample listing.",
  },
  {
    id: 10,
    title: "Your coffee corner starts here",
    category: "Room essentials",
    kind: "Buy",
    price: 950,
    image: "coffee",
    seller: "Tara B.",
    initials: "TB",
    batch: "Class of ’27",
    condition: "Like new",
    location: "Mess",
    rating: "4.9",
    description:
      "A small coffee ritual for slow mornings and long afternoons. Illustration only — this is a sample listing.",
  },
  {
    id: 11,
    title: "A softer spot to land",
    category: "Room essentials",
    kind: "Buy",
    price: 2400,
    image: "chair",
    seller: "Anaya J.",
    initials: "AJ",
    batch: "Class of ’26",
    condition: "Good",
    location: "Hostel lobby",
    rating: "4.8",
    description:
      "A comfy accent chair for reading, thinking, or doing absolutely nothing. Illustration only — this is a sample listing.",
  },
  {
    id: 12,
    title: "Ready for the next semester",
    category: "Just for fun",
    kind: "Buy",
    price: 800,
    image: "backpack",
    seller: "Vihaan L.",
    initials: "VL",
    batch: "Class of ’28",
    condition: "Like new",
    location: "Library",
    rating: "4.9",
    description:
      "A dependable backpack for your campus essentials. Illustration only — this is a sample listing.",
  },
];
export const imagePath = (listing: Listing) =>
  listing.image.startsWith("blob:")
    ? listing.image
    : `/images/${listing.image}.webp`;
export const priceLabel = (listing: Listing) =>
  listing.kind === "Free"
    ? "On the house"
    : `₹${listing.price.toLocaleString("en-IN")}`;
