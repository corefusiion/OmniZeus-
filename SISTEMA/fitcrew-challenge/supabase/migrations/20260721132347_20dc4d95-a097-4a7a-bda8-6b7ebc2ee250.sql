INSERT INTO public.badges (slug, name, icon, description)
VALUES ('duel_winner', 'Vencedor de Duelo', '⚔️', 'Venceu um duelo 1v1 semanal')
ON CONFLICT (slug) DO NOTHING;