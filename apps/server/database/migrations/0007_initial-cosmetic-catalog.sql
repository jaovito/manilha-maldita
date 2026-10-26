-- Product reference data, not player fixtures. Preserve existing curated entries.
INSERT INTO app.avatars (id, name, avatar_url, sprite_index, required_level, sort_order)
VALUES
  ('avatar-1', 'Avatar 1', '/art/avatars-pixel.png', 0, 1, 0),
  ('avatar-2', 'Avatar 2', '/art/avatars-pixel.png', 1, 2, 1),
  ('avatar-3', 'Avatar 3', '/art/avatars-pixel.png', 2, 3, 2),
  ('avatar-4', 'Avatar 4', '/art/avatars-pixel.png', 3, 4, 3)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO app.deck_themes (id, name, asset_key, required_level, sort_order)
VALUES
  ('classic', 'Clássico', 'classic', 1, 0),
  ('ember', 'Brasa', 'ember', 2, 1),
  ('arcane', 'Arcano', 'arcane', 4, 2)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO app.table_themes (id, name, asset_key, required_level, sort_order)
VALUES
  ('classic', 'Clássica', 'classic', 1, 0),
  ('burgundy', 'Vinho', 'burgundy', 3, 1),
  ('midnight', 'Meia-noite', 'midnight', 5, 2)
ON CONFLICT (id) DO NOTHING;
