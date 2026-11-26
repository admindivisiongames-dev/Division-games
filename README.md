# Division — Browser Games

Division is a mobile-first browser gaming platform with a dark charcoal interface, orange accents, lime highlights and the Division mascot.

## Pages and features
- Home: live game catalogue from Supabase, search and category filtering.
- Account: email sign-up, login, password reset and profile-role routing.
- Game page: iframe game player, fullscreen, likes, favourites, play history, comments and threaded replies.
- Profile: edit username/name/bio, upload avatar, view saved and recently played games.
- Admin: exact admin email + Supabase admin role gate; create, edit, publish and delete games.

## Stack
Plain HTML, CSS and JavaScript modules. Supabase Auth, Postgres and Storage. Vercel static hosting.

## Supabase tables used
`games`, `profiles`, `likes`, `favorites`, `play_history`, `comments`, `comment_likes`.
Avatar uploads use the public `avatars` Storage bucket. Existing RLS policies must remain enabled and enforce ownership.

## Deployment
This clean rebuild is being developed on `clean-rebuild`. The current production `main` branch is kept intact until the new version is checked. Vercel should build the selected branch as a preview.

Do not put Supabase service-role or secret keys in client files. `assets/script/config.js` contains only the public publishable key.

## Admin
The admin page requires both:
- profile role `admin`
- signed-in email `admin.division.games@gmail.com`

Never rely on the frontend gate alone; the database RLS policies must also restrict game mutations to authorised admins.
