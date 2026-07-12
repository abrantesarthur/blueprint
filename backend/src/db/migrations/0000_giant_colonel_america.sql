CREATE TYPE "public"."role_enum" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(16) NOT NULL,
	"code" varchar(64) NOT NULL,
	"request_token" varchar(64) NOT NULL,
	"expires_at" timestamp (3) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "otp_codes_phone_unique" UNIQUE("phone"),
	CONSTRAINT "otp_phone_format" CHECK ("otp_codes"."phone" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(16) NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"role" "role_enum" DEFAULT 'user' NOT NULL,
	"otp_requested_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "first_name_no_digits" CHECK ("users"."first_name" ~ '^[^\d]*$'),
	CONSTRAINT "last_name_no_digits" CHECK ("users"."last_name" ~ '^[^\d]*$'),
	CONSTRAINT "phone_format" CHECK ("users"."phone" ~ '^\+[1-9][0-9]{7,14}$')
);
