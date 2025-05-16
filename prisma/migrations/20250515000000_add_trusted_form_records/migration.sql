-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "trusted_form_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "certificate_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "page_url" TEXT NOT NULL,
    "reference" TEXT,
    "vendor" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "trusted_form_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trusted_form_records_certificate_id_key" ON "trusted_form_records"("certificate_id");

-- CreateIndex
CREATE INDEX "trusted_form_records_phone_number_idx" ON "trusted_form_records"("phone_number");

-- CreateIndex
CREATE INDEX "trusted_form_records_email_idx" ON "trusted_form_records"("email");

-- CreateIndex
CREATE INDEX "trusted_form_records_created_at_idx" ON "trusted_form_records"("created_at");

-- CreateIndex
CREATE INDEX "trusted_form_records_status_idx" ON "trusted_form_records"("status");
