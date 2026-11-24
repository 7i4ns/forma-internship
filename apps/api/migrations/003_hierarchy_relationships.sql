-- CSV parent_company expresses hierarchy, not an established supplier/customer
-- direction. Preserve both relationship models without relabelling its meaning.
ALTER TABLE relationships ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE relationships ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE relationships ADD COLUMN parent_company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE relationships ADD COLUMN child_company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE relationships ADD CONSTRAINT relationships_valid_pair CHECK (
  (supplier_id IS NOT NULL AND customer_id IS NOT NULL AND parent_company_id IS NULL AND child_company_id IS NULL)
  OR (supplier_id IS NULL AND customer_id IS NULL AND parent_company_id IS NOT NULL AND child_company_id IS NOT NULL)
);
ALTER TABLE relationships ADD CONSTRAINT relationships_hierarchy_no_self CHECK (parent_company_id <> child_company_id);
ALTER TABLE relationships ADD CONSTRAINT relationships_hierarchy_unique UNIQUE(parent_company_id, child_company_id, relationship_type);
CREATE INDEX relationships_child_company_idx ON relationships(child_company_id);
