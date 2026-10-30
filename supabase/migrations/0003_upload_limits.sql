-- Enforce the existing 5 MiB image-only product limit in Storage, not just the UI.
update storage.buckets set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
where id in ('listing-photos','chat-attachments');
