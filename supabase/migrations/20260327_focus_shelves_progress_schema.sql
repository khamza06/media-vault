alter table public.items
add column if not exists total_episodes integer,
add column if not exists current_page integer,
add column if not exists total_pages integer,
add column if not exists last_progress_at timestamptz;

update public.items
set
  total_episodes = case
    when type = 'Movie' then 1
    when type in ('Anime', 'TV Series') then coalesce(total_episodes, total_progress)
    else total_episodes
  end,
  current_page = case
    when type in ('Manga', 'Manhwa', 'Manhua', 'Book') then coalesce(current_page, progress)
    else current_page
  end,
  total_pages = case
    when type in ('Manga', 'Manhwa', 'Manhua', 'Book') then coalesce(total_pages, total_progress)
    else total_pages
  end,
  last_progress_at = case
    when coalesce(progress, 0) > 0 then coalesce(last_progress_at, created_at, now())
    else last_progress_at
  end;

update public.items
set
  total_episodes = 1,
  total_progress = 1
where type = 'Movie';

create index if not exists items_last_progress_at_idx on public.items(last_progress_at desc);

alter table public.items
drop constraint if exists items_status_by_type_check;

alter table public.items
add constraint items_status_by_type_check check (
  (
    type in ('Manga', 'Manhwa', 'Manhua', 'Book')
    and status in ('Reading', 'Planning', 'Dropped', 'Completed')
  )
  or (
    type in ('Anime', 'Movie', 'TV Series')
    and status in ('Watching', 'Dropped', 'Completed', 'Planning', 'Re-Watching')
  )
);

alter table public.items
drop constraint if exists items_progress_shape_check;

alter table public.items
add constraint items_progress_shape_check check (
  (
    type in ('Manga', 'Manhwa', 'Manhua', 'Book')
    and total_episodes is null
  )
  or (
    type in ('Anime', 'Movie', 'TV Series')
    and current_page is null
    and total_pages is null
  )
);

alter table public.items
drop constraint if exists items_movie_total_episode_check;

alter table public.items
add constraint items_movie_total_episode_check check (
  type <> 'Movie' or coalesce(total_episodes, total_progress, 1) = 1
);
