ALTER TABLE "app"."avatars" DROP CONSTRAINT "avatars_sprite";--> statement-breakpoint
ALTER TABLE "app"."avatars" ADD CONSTRAINT "avatars_sprite" CHECK ("app"."avatars"."sprite_index" BETWEEN 0 AND 7);
--> statement-breakpoint
INSERT INTO app.avatars (id, name, avatar_url, sprite_index, required_level, sort_order)
VALUES
  ('avatar-5', 'Avatar 5', '/art/avatars/avatar-5.png', 4, 5, 4),
  ('avatar-6', 'Avatar 6', '/art/avatars/avatar-6.png', 5, 6, 5),
  ('avatar-7', 'Avatar 7', '/art/avatars/avatar-7.png', 6, 7, 6),
  ('avatar-8', 'Avatar 8', '/art/avatars/avatar-8.png', 7, 8, 7)
ON CONFLICT (id) DO NOTHING;
