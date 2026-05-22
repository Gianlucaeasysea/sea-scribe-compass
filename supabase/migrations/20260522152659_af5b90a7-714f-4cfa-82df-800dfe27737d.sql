
INSERT INTO public.segments (name, description, customer_count, avg_ltv, rules) VALUES
('Champions', 'Top clienti: alta frequenza, alto valore, acquisto recente. Ambassador naturali del brand.', 6, 1501.56, '[{"field":"tier","op":"=","value":"Champion"}]'::jsonb),
('Loyali', 'Clienti fedeli con acquisti ripetuti negli ultimi 3 mesi.', 38, 713.49, '[{"field":"tier","op":"=","value":"Loyal"}]'::jsonb),
('A Rischio Abbandono', 'Clienti storicamente attivi che non acquistano da oltre 6 mesi: priorità win-back.', 96, 990.77, '[{"field":"tier","op":"=","value":"At Risk"}]'::jsonb),
('Nuovi Naviganti', 'Primo acquisto negli ultimi 30 giorni: candidati ideali per onboarding e secondo ordine.', 537, 249.48, '[{"field":"tier","op":"=","value":"New"}]'::jsonb),
('Potenziali', 'Hanno acquistato 1-2 volte: nudge al riacquisto e cross-sell mirato.', 3503, 374.22, '[{"field":"tier","op":"=","value":"Potential"}]'::jsonb),
('Velisti High-LTV', 'Proprietari di barca a vela con LTV oltre €500: target per Olli, Jake Poles e Way2.', 0, 0, '[{"field":"boat_type","op":"=","value":"sailboat"},{"field":"lifetime_value","op":">=","value":500}]'::jsonb),
('Motoristi Premium', 'Proprietari di barca a motore con almeno un ordine premium.', 0, 0, '[{"field":"boat_type","op":"=","value":"motorboat"},{"field":"total_orders","op":">=","value":1}]'::jsonb),
('Membri Community', 'Iscritti al Circle Easysea: alta affinità e referral potenziali.', 0, 0, '[{"field":"circle_id","op":"is not","value":null}]'::jsonb),
('Italia Costa Tirrenica', 'Clienti italiani sulla costa tirrenica: target per eventi locali e fiere.', 0, 0, '[{"field":"country","op":"=","value":"IT"}]'::jsonb),
('Dormienti', 'Nessun acquisto da oltre 12 mesi: ultimo tentativo di reattivazione o esclusione liste.', 24814, 0, '[{"field":"tier","op":"=","value":"Lost"}]'::jsonb);

UPDATE public.segments s SET 
  customer_count = COALESCE((SELECT count(*) FROM customers c WHERE c.boat_type='sailboat' AND c.lifetime_value>=500),0),
  avg_ltv = COALESCE((SELECT avg(c.lifetime_value) FROM customers c WHERE c.boat_type='sailboat' AND c.lifetime_value>=500),0)
WHERE s.name='Velisti High-LTV';

UPDATE public.segments s SET 
  customer_count = COALESCE((SELECT count(*) FROM customers c WHERE c.boat_type='motorboat' AND c.total_orders>=1),0),
  avg_ltv = COALESCE((SELECT avg(c.lifetime_value) FROM customers c WHERE c.boat_type='motorboat' AND c.total_orders>=1),0)
WHERE s.name='Motoristi Premium';

UPDATE public.segments s SET 
  customer_count = COALESCE((SELECT count(*) FROM customers c WHERE c.circle_id IS NOT NULL),0),
  avg_ltv = COALESCE((SELECT avg(c.lifetime_value) FROM customers c WHERE c.circle_id IS NOT NULL),0)
WHERE s.name='Membri Community';

UPDATE public.segments s SET 
  customer_count = COALESCE((SELECT count(*) FROM customers c WHERE c.country IN ('IT','Italy','Italia')),0),
  avg_ltv = COALESCE((SELECT avg(c.lifetime_value) FROM customers c WHERE c.country IN ('IT','Italy','Italia')),0)
WHERE s.name='Italia Costa Tirrenica';
