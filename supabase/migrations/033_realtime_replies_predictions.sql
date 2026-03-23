-- Live updates for feed/detail: replies, prediction votes, probability snapshots
ALTER PUBLICATION supabase_realtime ADD TABLE public.replies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prediction_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prediction_probability_snapshots;
