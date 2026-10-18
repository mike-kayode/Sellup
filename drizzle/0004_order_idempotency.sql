ALTER TABLE "orders" ADD COLUMN "idempotency_key" varchar(100);
--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_unique" ON "orders" USING btree ("idempotency_key");