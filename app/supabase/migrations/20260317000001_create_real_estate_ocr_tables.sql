-- Properties table (main entity)
CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text,
  land_number text,
  land_type text,
  land_area text,
  building_name text,
  building_structure text,
  building_area text,
  building_date text,
  floors text,
  usage_type text,
  property_json jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ocr_processing', 'parsed', 'generated', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Buildings table
CREATE TABLE re_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  building_number text,
  structure text,
  floors text,
  area text,
  built_date text,
  usage text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Owners table
CREATE TABLE re_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text,
  address text,
  share text,
  registration_date text,
  cause text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Contracts table
CREATE TABLE re_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  seller_name text,
  seller_address text,
  buyer_name text,
  buyer_address text,
  price text,
  contract_date text,
  delivery_date text,
  payment_terms jsonb DEFAULT '[]'::jsonb,
  special_conditions text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Mortgages table
CREATE TABLE re_mortgages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  mortgage_type text,
  amount text,
  interest_rate text,
  debtor text,
  creditor text,
  registration_date text,
  cause text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Hazards table
CREATE TABLE re_hazards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  hazard_type text,
  risk_level text,
  zone_name text,
  flood_depth text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Documents table
CREATE TABLE re_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('registry', 'contract', 'drawing', 'hazard', 'other')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  ocr_status text NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_result jsonb,
  parsed_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_re_buildings_property ON re_buildings(property_id);
CREATE INDEX idx_re_owners_property ON re_owners(property_id);
CREATE INDEX idx_re_contracts_property ON re_contracts(property_id);
CREATE INDEX idx_re_mortgages_property ON re_mortgages(property_id);
CREATE INDEX idx_re_hazards_property ON re_hazards(property_id);
CREATE INDEX idx_re_documents_property ON re_documents(property_id);
CREATE INDEX idx_re_documents_type ON re_documents(document_type);

-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_mortgages ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_documents ENABLE ROW LEVEL SECURITY;

-- Allow all for local dev (service role)
CREATE POLICY "Allow all for properties" ON properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for re_buildings" ON re_buildings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for re_owners" ON re_owners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for re_contracts" ON re_contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for re_mortgages" ON re_mortgages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for re_hazards" ON re_hazards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for re_documents" ON re_documents FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: allow all for authenticated/service role
CREATE POLICY "Allow all uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Allow all downloads" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Allow all deletes" ON storage.objects FOR DELETE USING (bucket_id = 'documents');
