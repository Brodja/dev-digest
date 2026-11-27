CREATE TABLE "convention_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"status" text NOT NULL,
	"error_code" text,
	"error_message" text,
	"provider" text,
	"model" text,
	"commit_sha" text,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposed" integer DEFAULT 0 NOT NULL,
	"kept" integer DEFAULT 0 NOT NULL,
	"dropped_ungrounded" integer DEFAULT 0 NOT NULL,
	"dropped_duplicate" integer DEFAULT 0 NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"attempts" integer,
	"cost_usd" double precision,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "rejected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "evidence_start_line" integer;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "evidence_end_line" integer;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "commit_sha" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "convention_scans" ADD CONSTRAINT "convention_scans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convention_scans" ADD CONSTRAINT "convention_scans_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "convention_scans_repo_started_idx" ON "convention_scans" USING btree ("repo_id","started_at");--> statement-breakpoint
CREATE INDEX "conventions_ws_repo_idx" ON "conventions" USING btree ("workspace_id","repo_id");--> statement-breakpoint
ALTER TABLE "conventions" ADD CONSTRAINT "conventions_decision_ck" CHECK (NOT ("conventions"."accepted" AND "conventions"."rejected"));