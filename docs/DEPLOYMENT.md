# Deploying ReThread

> **Current live deployment:** <https://rethread-ten.vercel.app>
> Vercel project `rethread` (team ACME) · serverless API pinned to Mumbai (`bom1`) · database **MongoDB Atlas free cluster `rethread-db`** added through the Vercel Marketplace (it sets `MONGODB_URI` automatically) · `JWT_SECRET` set as a Vercel secret. The site seeds its demo data on first request.
> To ship an update from this folder: `npx vercel deploy --prod` (after `npx vercel login`).
>
> The steps below are for hosting your **own** copy from scratch.

You need **one free MongoDB Atlas database** and **one host**. Total time: ~15 minutes.

## 1. Create the database (MongoDB Atlas, free M0)

1. Sign up at <https://www.mongodb.com/cloud/atlas/register> (Google sign-in works).
2. **Create a deployment → M0 Free**, provider AWS, region **Mumbai (ap-south-1)**.
3. **Security → Database Access → Add user** — username `rethread`, autogenerate a password, role *Read and write to any database*. Copy the password.
4. **Security → Network Access → Add IP address → Allow access from anywhere** (`0.0.0.0/0`) — required for Vercel/Render.
5. **Connect → Drivers** and copy the connection string. Insert your password and add the database name `rethread`:

```
mongodb+srv://rethread:<password>@cluster0.xxxxx.mongodb.net/rethread?retryWrites=true&w=majority
```

The app seeds the realistic demo data automatically the first time it connects to an empty database.

## 2a. Deploy on Vercel (recommended)

1. Push this folder to a GitHub repository.
2. On <https://vercel.com/new> import the repository. Settings are read from `vercel.json` (no changes needed).
3. Add **Environment Variables**:

| Key | Value |
|---|---|
| `MONGODB_URI` | your Atlas connection string |
| `JWT_SECRET` | any long random string (e.g. from <https://generate-secret.vercel.app/64>) |
| `MONGOMS_DISABLE_POSTINSTALL` | `1` |

4. **Deploy.** Open the URL — the first request seeds the database (takes ~5 s).

On Vercel the API runs as a serverless function, so chat uses automatic 4-second polling instead of websockets (the header shows “Auto-refresh”).

## 2b. Deploy on Render (real-time websockets)

1. Push to GitHub, then on <https://dashboard.render.com> choose **New → Blueprint** and select the repo (`render.yaml` is detected).
2. Paste `MONGODB_URI` when prompted. `JWT_SECRET` is generated for you.
3. Deploy. Free instances sleep after 15 minutes of inactivity; the first visit afterwards takes ~30 s.

## 3. Verify

- `https://<your-app>/api/health` → `{"ok":true,…}`
- Log in as `aanya@rethread.in` / `Demo@1234` and `admin@rethread.in` / `Admin@1234`.
- Test the core flow: open a listing → **Request a swap** → log in as the owner in another browser → **Accept** → plan a meetup → both click **I received my item** → rate.

## Resetting demo data

```bash
MONGODB_URI="mongodb+srv://…" npm run seed
```
