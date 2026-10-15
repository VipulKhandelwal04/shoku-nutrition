-- Rebrand to Shoku (食, "a meal"): replace the original seed quotes and tour slides.
-- Only rows that still carry the original seed text are touched, so admin-edited content survives.

delete from public.quotes where text in (
  'Strength is built in the kitchen too.',
  'Show up for your plate the way you show up for class.',
  'One good meal is a rep. Stack them.',
  'You don''t need perfect. You need the next meal.',
  'Fuel first. Then fly.',
  'Ghar ka khana, gym ka results.',
  'Progress is a katori at a time.',
  'Eat like you mean to finish the workout.'
);

insert into public.quotes (text, author, sort) values
  ('You don''t need perfect. You need the next meal.', null, 1),
  ('Hara hachi bu: stop at eight parts full.', 'Okinawan saying', 2),
  ('Ichiju sansai: one soup, three sides.', 'Japanese home cooking', 3),
  ('Ghar ka khana, gym ka results.', null, 4),
  ('Progress is a katori at a time.', null, 5),
  ('Skipped breakfast? Lunch still counts.', null, 6),
  ('Eat like you mean to finish the workout.', null, 7),
  ('Train hard. Then eat a proper lunch.', null, 8);

update public.tour_slides set body = 'Your usual foods sit one tap away. Roti, dal, curd: tap plus and they''re in today''s diary.'
  where title = 'Log a meal in seconds' and body like 'Your usuals sit one tap away.%';
update public.tour_slides set body = 'Take a photo and AI Assist suggests the dishes and portions. Nothing is saved until you confirm.'
  where title = 'Snap your plate' and body like 'Take a photo and Katori%';
update public.tour_slides set body = 'See which food groups today''s meals have covered against India''s My Plate guide, and what to add next.'
  where title = 'Your plate vs your plan' and body like 'See the food groups you''ve hit%';
update public.tour_slides set title = 'Three meals, one day', body = 'Log any three meals and the day joins your streak. A slow day doesn''t cost you anything.'
  where title = 'Show up. Stack days.';
