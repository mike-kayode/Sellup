-- Image metadata records for cPanel-hosted image storage.
-- Actual image files live on the cPanel server filesystem under
-- CPANEL_UPLOAD_DIRECTORY. This table tracks metadata in PostgreSQL.
CREATE TABLE IF NOT EXISTS "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"file_name" varchar(255) NOT NULL,
	"original_name" varchar(255),
	"file_path" varchar(500) NOT NULL,
	"public_url" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"resource_type" varchar(50),
	"resource_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "images_owner_id_idx" ON "images" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "images_resource_idx" ON "images" USING btree ("resource_type", "resource_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "images_file_path_idx" ON "images" USING btree ("file_path");