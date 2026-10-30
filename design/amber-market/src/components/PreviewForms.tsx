import { useState, type FormEvent } from "react";
import { ArrowRight, ImagePlus, Info, MapPin } from "lucide-react";
import { categories, type Category, type Listing } from "../data";

export function CreateListing({
  onCreate,
}: {
  onCreate: (listing: Listing) => void;
}) {
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (title.length < 3) {
      setError("Give your find a title of at least 3 characters.");
      return;
    }
    const category = String(data.get("category")) as Category;
    const fallback =
      category === "Electronics"
        ? "headphones"
        : category === "Books & notes"
          ? "books"
          : category === "Cycles & sports"
            ? "cycle"
            : "lamp";
    onCreate({
      id: Date.now(),
      title,
      category,
      kind: "Buy",
      price: Number(data.get("price")),
      condition: "Good",
      image: photo || fallback,
      seller: "You · preview",
      initials: "YO",
      batch: "Campus member",
      rating: "—",
      location: "Campus handover",
      badge: "Just added",
      description:
        "A listing you created in this design preview. It stays in this browser session and is not published.",
    });
  };
  return (
    <form className="preview-form" onSubmit={submit}>
      <h2>
        A little space.
        <br />
        <em>A new possibility.</em>
      </h2>
      <p className="form-description">
        Try listing something. This preview keeps it in your browser session.
      </p>
      <label className="photo-picker">
        {photo ? (
          <img src={photo} alt="Your local preview" />
        ) : (
          <>
            <ImagePlus size={28} strokeWidth={1.3} />
            <strong>Add a photo</strong>
            <span>Optional · JPG, PNG or WebP · up to 5 MB</span>
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Photo for preview listing"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
              file.size > 5 * 1024 * 1024
            ) {
              setError("Choose a JPG, PNG or WebP under 5 MB.");
              return;
            }
            setError("");
            setPhoto(URL.createObjectURL(file));
          }}
        />
      </label>
      <label>
        What are you passing on?
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          placeholder="A desk lamp with a little character"
        />
      </label>
      <div className="form-row">
        <label>
          Category
          <select name="category">
            {categories.slice(1).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Price (₹)
          <input
            name="price"
            type="number"
            required
            min="0"
            step="1"
            placeholder="750"
          />
        </label>
      </div>
      <p className="form-info">
        <Info size={15} />
        Nothing is uploaded or published from this preview.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary-button" type="submit">
        Add preview listing <ArrowRight size={18} />
      </button>
    </form>
  );
}

export function AccessInfo({ onClose }: { onClose: () => void }) {
  return (
    <div className="access-info">
      <span className="access-illustration">
        <MapPin size={40} strokeWidth={1} />
      </span>
      <p className="eyebrow">THE CAMPUS CIRCLE</p>
      <h2>
        Familiar faces.
        <br />
        <em>Good company.</em>
      </h2>
      <p>
        Real campus trades start with your institute account and student
        approval.
      </p>
      <p>
        You’re exploring a design preview here. Sign-in and seller conversations
        connect through the main marketplace—not through these sample listings.
      </p>
      <button className="primary-button" type="button" onClick={onClose}>
        Keep exploring <ArrowRight size={17} />
      </button>
    </div>
  );
}
