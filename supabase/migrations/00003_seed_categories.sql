INSERT INTO public.categories (slug, name_pt, name_zh, default_ncm_prefix, ml_category_id, benchmark_margin_min, benchmark_margin_target, regulatory_alerts) VALUES
('auto_parts', 'Auto Peças', '汽车配件', '8708', 'MLB1743', 50.00, 80.00, '{}'::jsonb),
('home_goods', 'Utilidades Domésticas', '家居用品', '7323', 'MLB1574', 40.00, 70.00, '{}'::jsonb),
('toys', 'Brinquedos', '玩具', '9503', 'MLB1132', 45.00, 75.00, '{"inmetro_required": true, "warning": "Brinquedos vendidos no Brasil exigem certificação Inmetro. Considere custos de certificação no landed cost."}'::jsonb),
('generic', 'Outros', '其他', null, null, 30.00, 50.00, '{}'::jsonb);
