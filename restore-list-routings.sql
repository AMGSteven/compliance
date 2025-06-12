-- SQL to restore the original list routings configuration
DELETE FROM list_routings WHERE 1=1;

-- Insert the original list routing entries based on the image shared
INSERT INTO list_routings (list_id, campaign_id, cadence_id, token, description, bid, active, created_at) VALUES
('OPG4', 'fun', 'cadence_1', NULL, 'some junk', 0.75, true, NOW()),
('a3838fdd-33a2-4750-9f5c-92aabfcdfe7e', 'default-campaign', 'cadence_2', NULL, 'Juiced default-campaign', 1.25, true, NOW()),
('juiced-auto', 'auto_insurance', 'cadence_3', NULL, 'Juiced auto insurance', 1.25, true, NOW()),
('1b759232-2264-421a-9171-3dabf316dc03', 'health-insurance-campaign', 'cadence_4', NULL, 'Onpoint health-insurance-campaign', 0.85, true, NOW()),
('1b759232-2264-421a-9171-3dabf316dc03', 'default-campaign', 'cadence_5', NULL, 'Onpoint default-campaign', 0.85, true, NOW()),
('health-insurance-data-us', 'health', 'cadence_1', NULL, 'health', 1.25, true, NOW()),
('1b759232-2264-421a-9171-3dabf316dc03', 'h2-bdskf-ftdl-adra-bjdrk-tlr7h2q6fkh20', 'cadence_7', NULL, 'Onpoint h2-bdskf-ftdl-adra-bjdrk-tlr7h2q6fkh20', 0.85, true, NOW()),
('OPG4', 'life_insurance', 'cadence_3', NULL, 'Onpoint life_insurance', 0.85, true, NOW()),
('OPG3', 'medicare', 'cadence_4', NULL, 'Onpoint medicare', 0.85, true, NOW()),
('a3838fdd-33a2-4750-9f5c-92aabfcdfe7e', 'originalCampaignId/EnrollmentValidation', 'cadence_5', NULL, 'Juiced originalCampaignId/EnrollmentValidation', 1.25, true, NOW());
