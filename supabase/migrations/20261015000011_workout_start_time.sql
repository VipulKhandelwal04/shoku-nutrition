-- Workout times and Today timeline (#11): when a workout started, as local wall-clock time on its day.
-- Strava imports fill it from the activity's local start; manual logs from "When?". Null = unknown (older rows),
-- which the timeline places by when the workout was recorded. Additive: existing rows stay as they are.
alter table public.workouts add column if not exists start_time time;
