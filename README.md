# Division — Browser Games

Mobile-first browser game platform built from the provided HTML design references.

## Pages
- `index.html`: game directory, search, categories, theme toggle
- `game.html?id=game-id`: game detail, likes, favourites, comments
- `auth.html`: Supabase email/password sign-up and login
- `profile.html`: player profile, saved and recently played games
- `admin.html`: admin-only game management

## Supabase
Supabase URL and the public publishable key are configured in `assets/script/config.js`. Never add a service-role key to frontend code.

Tables: profiles, games, likes, comments, favorites, play_history. Row Level Security protects user-owned actions and admin game management.

### Give your first account admin access
Create your account on Division, then run this in Supabase SQL Editor with your account email:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```

Only the project owner should promote accounts. The site cannot grant itself admin access.

## Demo games
The database includes clearly marked starter demo entries. From Admin, edit a game to add a playable URL or delete it and add a real game. Demo listings are not full playable games until you attach actual game content.

## Deploy
Connect this repository to Vercel and deploy the repository root as a static site. No build command is required. Set the Supabase Auth Site URL and redirect URLs to your Vercel domain before testing email confirmation.
