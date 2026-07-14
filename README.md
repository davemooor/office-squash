# Office Squash League

A small office squash league dashboard using plain HTML, CSS, JavaScript,
Supabase and Cloudflare Pages.

## Ranking

Players are ordered by **Office Champ**, an Elo-based rating using K = 24.

## Season Points

Season Points are:

`games won + 0.5 × matches played`

## Deployment

Cloudflare Pages deploys automatically from the GitHub `main` branch.

## Database updates

Run SQL migrations in numeric order from the `sql` folder.
