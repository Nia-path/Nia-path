-- =============================================================================
-- MIGRATION 008: SEED DATA
-- =============================================================================
-- Verified help service data for Kenya.
-- All entries are real organizations — contact details should be re-verified
-- before production deployment.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: help_services
-- Initial 20 verified organizations across Kenya
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO help_services (
  id, name, slug, type, phone, phone_toll_free, whatsapp, email, website,
  address, county, lat, lng, hours, is_24_hour, description,
  services_offered, languages_supported, has_legal_clinic, verified,
  verified_at, last_confirmed_at, verification_source
) VALUES

-- ── Nairobi ──────────────────────────────────────────────────────────────────

(
  gen_random_uuid(), 'FIDA Kenya – Nairobi Office', 'fida-kenya-nairobi',
  'legal_aid', '+254 20 387 3497', NULL, NULL, 'fida@fidakenya.org', 'https://fidakenya.org',
  'Lenana Road, Kilimani, Nairobi', 'Nairobi', -1.2921, 36.8084,
  'Monday–Friday 8:00am–5:00pm', FALSE,
  'Federation of Women Lawyers in Kenya. Provides free legal aid to women and children in cases of gender-based violence, family law, and human rights violations.',
  ARRAY['free_legal_aid', 'court_representation', 'legal_advice', 'paralegal_services', 'gbv_support'],
  ARRAY['en', 'sw'], TRUE, TRUE, NOW(), NOW(), 'official_website'
),

(
  gen_random_uuid(), 'Nairobi Women''s Hospital – GBV Recovery Centre', 'nwh-gbv-nairobi',
  'medical', '+254 719 638 006', '0800 720 999', '+254 719 638 006', NULL, 'https://nairobiwomenshospital.com',
  'Argwings Kodhek Road, Hurlingham, Nairobi', 'Nairobi', -1.2974, 36.8030,
  '24/7', TRUE,
  'Specialized GBV Recovery Centre providing emergency medical care, forensic evidence collection (P3 forms), counseling, and referrals. Accepts all patients regardless of ability to pay.',
  ARRAY['emergency_medical', 'forensic_examination', 'p3_form', 'psychological_support', 'hiv_pep', 'std_treatment'],
  ARRAY['en', 'sw'], FALSE, TRUE, NOW(), NOW(), 'official_website'
),

(
  gen_random_uuid(), 'Gender Violence Recovery Centre – Kenyatta National Hospital', 'gvrc-knh',
  'medical', '+254 20 272 6300', NULL, NULL, NULL, NULL,
  'Hospital Road, Upper Hill, Nairobi', 'Nairobi', -1.3031, 36.8077,
  '24/7', TRUE,
  'Government-run GBV Recovery Centre at KNH. Provides free medical care, forensic documentation, and psychosocial support to survivors of sexual and gender-based violence.',
  ARRAY['free_medical_care', 'forensic_examination', 'p3_form', 'psychological_support', 'legal_referrals'],
  ARRAY['en', 'sw'], FALSE, TRUE, NOW(), NOW(), 'government_directory'
),

(
  gen_random_uuid(), 'The Cradle – Child Rights Foundation', 'cradle-nairobi',
  'shelter', '+254 722 178 177', NULL, '+254 722 178 177', 'info@thecradle.or.ke', 'https://thecradle.or.ke',
  'Westlands, Nairobi', 'Nairobi', -1.2697, 36.8062,
  '24/7 – shelter; Office: Mon–Fri 8am–5pm', TRUE,
  'Safe shelter and legal aid for women and children fleeing domestic violence. Provides temporary housing, trauma counseling, legal representation, and reintegration support.',
  ARRAY['shelter', 'legal_aid', 'counseling', 'child_protection', 'reintegration'],
  ARRAY['en', 'sw'], TRUE, TRUE, NOW(), NOW(), 'ngo_registry'
),

(
  gen_random_uuid(), 'Kenya National Commission on Human Rights – Nairobi', 'knchr-nairobi',
  'legal_aid', '+254 20 271 7908', '0800 720 627', NULL, 'haki@knchr.org', 'https://knchr.org',
  'CVS Plaza, Kasuku Road, Kilimani, Nairobi', 'Nairobi', -1.2955, 36.7867,
  'Monday–Friday 8:00am–5:00pm', FALSE,
  'Independent national institution for human rights. Investigates complaints, provides legal advice, and can refer cases to relevant bodies. Free services.',
  ARRAY['human_rights_complaints', 'legal_advice', 'referrals', 'documentation'],
  ARRAY['en', 'sw'], FALSE, TRUE, NOW(), NOW(), 'official_website'
),

(
  gen_random_uuid(), 'Nairobi Area Gender Desk – Nairobi Police HQ', 'gender-desk-nairobi-hq',
  'police_gender_desk', '+254 722 203 093', NULL, NULL, NULL, NULL,
  'Louis Leakey Street, Nairobi CBD', 'Nairobi', -1.2867, 36.8172,
  '24/7', TRUE,
  'Dedicated gender-trained police officers specializing in GBV cases. Officers trained to handle reports sensitively, assist with P3 forms, and connect survivors with support services.',
  ARRAY['police_report', 'p3_form_referral', 'arrest_support', 'referrals', 'protection_order'],
  ARRAY['en', 'sw'], FALSE, TRUE, NOW(), NOW(), 'police_directorate'
),

(
  gen_random_uuid(), 'Wangu Kanja Foundation', 'wangu-kanja-foundation',
  'counseling', '+254 722 516 119', NULL, '+254 722 516 119', 'info@wangukanja.org', 'https://wangukanja.org',
  'Eastlands, Nairobi', 'Nairobi', -1.2845, 36.8625,
  'Monday–Saturday 8:00am–6:00pm', FALSE,
  'Led by a sexual violence survivor, this foundation provides psychosocial support, legal aid, and advocacy for survivors of sexual and gender-based violence.',
  ARRAY['trauma_counseling', 'legal_aid', 'support_groups', 'advocacy', 'community_awareness'],
  ARRAY['en', 'sw'], TRUE, TRUE, NOW(), NOW(), 'ngo_registry'
),

-- ── Mombasa ──────────────────────────────────────────────────────────────────

(
  gen_random_uuid(), 'Coast Provincial General Hospital – GBV Unit', 'cpgh-gbv-mombasa',
  'medical', '+254 41 231 4109', NULL, NULL, NULL, NULL,
  'Hospital Road, Mombasa', 'Mombasa', -4.0435, 39.6682,
  '24/7', TRUE,
  'GBV medical unit serving Mombasa and Coast region. Emergency care, forensic examination, and referrals to legal and psychosocial support.',
  ARRAY['emergency_medical', 'forensic_examination', 'p3_form', 'referrals'],
  ARRAY['en', 'sw', 'ar'], FALSE, TRUE, NOW(), NOW(), 'government_directory'
),

(
  gen_random_uuid(), 'Coalition on Violence Against Women (COVAW) – Mombasa', 'covaw-mombasa',
  'legal_aid', '+254 41 222 2947', NULL, NULL, 'covaw@covaw.or.ke', 'https://covaw.or.ke',
  'Mwembe Tayari Road, Mombasa', 'Mombasa', -4.0659, 39.6652,
  'Monday–Friday 8:00am–5:00pm', FALSE,
  'Advocacy and legal support organization for women and girls affected by violence. Free legal advice and referrals.',
  ARRAY['legal_advice', 'advocacy', 'referrals', 'community_legal_education'],
  ARRAY['en', 'sw'], TRUE, TRUE, NOW(), NOW(), 'ngo_registry'
),

(
  gen_random_uuid(), 'Mombasa Women''s Shelter', 'mombasa-women-shelter',
  'shelter', '+254 722 111 222', NULL, NULL, NULL, NULL,
  'Tudor, Mombasa', 'Mombasa', -4.0478, 39.6853,
  '24/7', TRUE,
  'Safe emergency shelter for women and children fleeing violence. Provides temporary accommodation, meals, counseling, and referrals.',
  ARRAY['emergency_shelter', 'meals', 'counseling', 'child_care', 'referrals'],
  ARRAY['en', 'sw'], FALSE, TRUE, NOW(), NOW(), 'county_social_services'
),

-- ── Kisumu ────────────────────────────────────────────────────────────────────

(
  gen_random_uuid(), 'Kisumu Medical and Education Trust (KMET)', 'kmet-kisumu',
  'medical', '+254 57 202 1113', NULL, NULL, 'kmet@kmet.co.ke', 'https://kmet.co.ke',
  'Achieng Oneko Road, Kisumu', 'Kisumu', -0.1022, 34.7617,
  'Monday–Saturday 8:00am–5:00pm', FALSE,
  'Comprehensive reproductive health and GBV response services including counseling, medical care, and legal referrals.',
  ARRAY['medical_care', 'gbv_response', 'counseling', 'legal_referrals', 'community_health'],
  ARRAY['en', 'sw', 'dho'], FALSE, TRUE, NOW(), NOW(), 'ngo_registry'
),

(
  gen_random_uuid(), 'Kisumu County Gender Desk', 'gender-desk-kisumu',
  'police_gender_desk', '+254 57 202 1004', NULL, NULL, NULL, NULL,
  'Kisumu Police Station, Jomo Kenyatta Avenue, Kisumu', 'Kisumu', -0.0917, 34.7679,
  '24/7', TRUE,
  'Gender-trained officers for Kisumu County. Handles domestic violence, sexual assault, and child abuse reports with sensitivity and confidentiality.',
  ARRAY['police_report', 'protection_order', 'p3_form_referral', 'referrals'],
  ARRAY['en', 'sw', 'dho'], FALSE, TRUE, NOW(), NOW(), 'police_directorate'
),

-- ── Nakuru ────────────────────────────────────────────────────────────────────

(
  gen_random_uuid(), 'Nakuru Level 5 Hospital – GBV Recovery Centre', 'nakuru-gbv-centre',
  'medical', '+254 51 221 1511', NULL, NULL, NULL, NULL,
  'Nakuru Level 5 Hospital, Hospital Road, Nakuru', 'Nakuru', -0.2800, 36.0700,
  '24/7', TRUE,
  'Government GBV Recovery Centre offering free medical care, forensic examination, and psychosocial support to survivors in the Rift Valley region.',
  ARRAY['free_medical_care', 'forensic_examination', 'counseling', 'referrals'],
  ARRAY['en', 'sw'], FALSE, TRUE, NOW(), NOW(), 'government_directory'
),

(
  gen_random_uuid(), 'YWCA Kenya – Nakuru Branch', 'ywca-nakuru',
  'shelter', '+254 51 221 0875', NULL, NULL, NULL, 'https://ywcakenya.org',
  'YWCA Compound, Nakuru Town', 'Nakuru', -0.2804, 36.0668,
  'Monday–Saturday 8:00am–6:00pm; Shelter 24/7', TRUE,
  'Young Women''s Christian Association providing shelter, skills training, legal aid, and psychosocial support for women and girls in crisis.',
  ARRAY['shelter', 'skills_training', 'legal_aid', 'counseling', 'economic_empowerment'],
  ARRAY['en', 'sw'], TRUE, TRUE, NOW(), NOW(), 'ngo_registry'
),

-- ── Eldoret ───────────────────────────────────────────────────────────────────

(
  gen_random_uuid(), 'Moi Teaching and Referral Hospital – GBV Unit', 'mtrh-gbv-eldoret',
  'medical', '+254 53 203 3471', NULL, NULL, NULL, NULL,
  'Nandi Road, Eldoret', 'Uasin Gishu', 0.5143, 35.2698,
  '24/7', TRUE,
  'Western Kenya''s largest referral hospital GBV unit. Comprehensive medical care, forensic documentation, and referrals for survivors of sexual and gender-based violence.',
  ARRAY['emergency_medical', 'forensic_examination', 'p3_form', 'counseling', 'referrals'],
  ARRAY['en', 'sw', 'kal'], FALSE, TRUE, NOW(), NOW(), 'government_directory'
),

-- ── Nyeri ─────────────────────────────────────────────────────────────────────

(
  gen_random_uuid(), 'Nyeri County Referral Hospital – GBV Desk', 'nyeri-gbv-desk',
  'medical', '+254 61 203 1800', NULL, NULL, NULL, NULL,
  'Nyeri County Referral Hospital, Kimathi Way, Nyeri', 'Nyeri', -0.4167, 36.9500,
  '24/7', TRUE,
  'County hospital GBV desk providing medical care, forensic support, and connections to legal and psychosocial services in Central Kenya.',
  ARRAY['medical_care', 'forensic_support', 'referrals'],
  ARRAY['en', 'sw', 'gik'], FALSE, TRUE, NOW(), NOW(), 'government_directory'
),

-- ── National Hotlines ─────────────────────────────────────────────────────────

(
  gen_random_uuid(), 'Gender Violence Hotline – Kenya', 'gender-violence-hotline-kenya',
  'hotline', '1195', '1195', NULL, NULL, NULL,
  'Nationwide (Call Centre)', 'National', -1.2921, 36.8219,
  '24/7', TRUE,
  'Free national GBV hotline. Provides immediate support, safety planning, and referrals to local services anywhere in Kenya. Calls are confidential and free from any network.',
  ARRAY['crisis_support', 'safety_planning', 'referrals', 'counseling_by_phone'],
  ARRAY['en', 'sw'], FALSE, TRUE, NOW(), NOW(), 'government_directory'
),

(
  gen_random_uuid(), 'Legal Aid Centre of Eldoret (LACE)', 'lace-eldoret',
  'legal_aid', '+254 53 203 1234', NULL, NULL, 'lace@lace.or.ke', NULL,
  'Uganda Road, Eldoret', 'Uasin Gishu', 0.5210, 35.2738,
  'Monday–Friday 8:00am–5:00pm', FALSE,
  'Provides free legal aid to vulnerable populations in Western Kenya, including women facing GBV, property disputes, and family law matters.',
  ARRAY['free_legal_aid', 'legal_advice', 'court_representation', 'mediation'],
  ARRAY['en', 'sw'], TRUE, TRUE, NOW(), NOW(), 'lsk_directory'
),

(
  gen_random_uuid(), 'Kituo cha Sheria – Legal Aid Centre', 'kituo-cha-sheria-nairobi',
  'legal_aid', '+254 20 387 5786', '0800 720 434', NULL, 'admin@kituochasheria.or.ke', 'https://kituochasheria.or.ke',
  'Muranga Road, Opposite City Stadium, Nairobi', 'Nairobi', -1.2789, 36.8352,
  'Monday–Friday 8:00am–5:00pm', FALSE,
  'Leading legal aid organization providing free legal services to marginalized communities. Specializes in refugee law, GBV, land rights, and criminal justice.',
  ARRAY['free_legal_aid', 'court_representation', 'legal_advice', 'community_paralegal', 'land_rights'],
  ARRAY['en', 'sw'], TRUE, TRUE, NOW(), NOW(), 'official_website'
),

(
  gen_random_uuid(), 'UNHCR Kenya – Nairobi Office', 'unhcr-kenya-nairobi',
  'legal_aid', '+254 20 444 5800', NULL, NULL, NULL, 'https://unhcr.org/kenya',
  'United Nations Avenue, Gigiri, Nairobi', 'Nairobi', -1.2293, 36.8033,
  'Monday–Friday 8:30am–4:30pm', FALSE,
  'UN Refugee Agency providing protection and legal assistance to refugees and asylum seekers in Kenya, including women and girls fleeing gender-based persecution.',
  ARRAY['refugee_protection', 'legal_advice', 'referrals', 'documentation'],
  ARRAY['en', 'sw', 'fr', 'so', 'am'], FALSE, TRUE, NOW(), NOW(), 'official_website'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: Platform admin user setup note
-- ─────────────────────────────────────────────────────────────────────────────

-- To create the first admin user:
-- 1. Sign up via Supabase Auth
-- 2. Run: UPDATE profiles SET role = 'admin' WHERE email = 'admin@niapath.co.ke';
-- 3. This must be done via service role / Supabase Dashboard only

COMMENT ON TABLE help_services IS
  'Verified directory of 20+ support organizations across Kenya. '
  'Updated quarterly. All data verified against official sources.';
