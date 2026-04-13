-- Remessa Conforme (padrão simplificado)
INSERT INTO public.tax_rates (tax_type, regime, rate, valid_from, description) VALUES
('rc_flat', 'remessa_conforme', 0.2000, CURRENT_DATE, 'RC até USD 50: 20% II + ICMS estadual'),
('rc_flat', 'remessa_conforme', 0.6000, CURRENT_DATE, 'RC acima USD 50: 60% II + ICMS estadual');

-- Importação Formal (valores padrão, podem ser sobrescritos por NCM específico)
INSERT INTO public.tax_rates (tax_type, regime, rate, valid_from, description) VALUES
('ii', 'formal', 0.1600, CURRENT_DATE, 'II padrão (ajustar por NCM específico)'),
('ipi', 'formal', 0.0000, CURRENT_DATE, 'IPI padrão'),
('pis_imp', 'formal', 0.0210, CURRENT_DATE, 'PIS-Importação'),
('cofins_imp', 'formal', 0.1065, CURRENT_DATE, 'COFINS-Importação');

-- ICMS por estado (formal)
INSERT INTO public.tax_rates (tax_type, regime, state, rate, valid_from, description) VALUES
('icms', 'formal', 'SP', 0.1800, CURRENT_DATE, 'ICMS SP'),
('icms', 'formal', 'SC', 0.1700, CURRENT_DATE, 'ICMS SC padrão'),
('icms', 'formal', 'PR', 0.1800, CURRENT_DATE, 'ICMS PR'),
('icms', 'formal', 'RJ', 0.2000, CURRENT_DATE, 'ICMS RJ'),
('icms', 'formal', 'ES', 0.1700, CURRENT_DATE, 'ICMS ES'),
('icms', 'formal', 'MG', 0.1800, CURRENT_DATE, 'ICMS MG');

-- ICMS Remessa Conforme por estado
INSERT INTO public.tax_rates (tax_type, regime, state, rate, valid_from, description) VALUES
('icms', 'remessa_conforme', 'SP', 0.1700, CURRENT_DATE, 'ICMS RC SP'),
('icms', 'remessa_conforme', 'SC', 0.1700, CURRENT_DATE, 'ICMS RC SC'),
('icms', 'remessa_conforme', 'RJ', 0.2000, CURRENT_DATE, 'ICMS RC RJ'),
('icms', 'remessa_conforme', 'MG', 0.1800, CURRENT_DATE, 'ICMS RC MG'),
('icms', 'remessa_conforme', 'PR', 0.1900, CURRENT_DATE, 'ICMS RC PR'),
('icms', 'remessa_conforme', 'ES', 0.1700, CURRENT_DATE, 'ICMS RC ES');

-- Auto peças - II específico por NCM
INSERT INTO public.tax_rates (tax_type, regime, ncm_prefix, rate, valid_from, description) VALUES
('ii', 'formal', '8708', 0.1800, CURRENT_DATE, 'II Auto Peças (NCM 8708.xx)'),
('ii', 'formal', '8409', 0.1400, CURRENT_DATE, 'II Peças de motor (NCM 8409.xx)'),
('ii', 'formal', '8421', 0.1400, CURRENT_DATE, 'II Filtros (NCM 8421.xx)');

-- Brinquedos
INSERT INTO public.tax_rates (tax_type, regime, ncm_prefix, rate, valid_from, description) VALUES
('ii', 'formal', '9503', 0.2000, CURRENT_DATE, 'II Brinquedos (NCM 9503.xx)'),
('ipi', 'formal', '9503', 0.0000, CURRENT_DATE, 'IPI Brinquedos isento');

-- Utilidades domésticas
INSERT INTO public.tax_rates (tax_type, regime, ncm_prefix, rate, valid_from, description) VALUES
('ii', 'formal', '7323', 0.1800, CURRENT_DATE, 'II Artigos cozinha aço/ferro (NCM 7323.xx)'),
('ii', 'formal', '3924', 0.1800, CURRENT_DATE, 'II Artigos plástico (NCM 3924.xx)'),
('ii', 'formal', '8215', 0.1800, CURRENT_DATE, 'II Talheres (NCM 8215.xx)');
