# Nova AI — Full-stack starter

This is a working full-stack **starter**, not a hosted AI service. It provides:
- responsive chat UI with chat history saved in the browser
- server-side AI proxy (OpenAI-compatible chat-completions endpoint)
- optional real web search via Tavily API, with URLs returned as visible sources
- file upload for text/PDF-like text formats and video metadata upload (actual video understanding depends on the configured model/provider)
- Supabase email/password auth plus Google/Apple OAuth buttons
- explicit UI status when services are not configured; no fabricated assistant answers

## Requirements
- Node.js 20+ recommended
- An AI provider API key/model. The server supports providers exposing an OpenAI-compatible `/chat/completions` endpoint.
- Optional: Tavily API key for web search.
- Optional: Supabase project for account registration/sign-in and OAuth.

## Run locally
1. Extract the ZIP.
2. Copy `.env.example` to `.env`.
3. Set `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` for your chosen provider.
4. For real web search, set `TAVILY_API_KEY`.
5. For auth, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
6. In a terminal in this folder, run:
   ```bash
   npm install
   npm start
   ```
7. Open `http://localhost:3000`.

If AI credentials are missing, chat requests return a visible configuration error instead of pretending to answer.

## Authentication setup
Create a Supabase project. In Authentication → URL Configuration, add your local and deployed site URLs. Enable Email auth. For Google and Apple, configure the provider credentials in Supabase's provider settings and follow their current setup guides. The UI buttons only work once Supabase auth is configured.

This starter does not implement password storage itself. Supabase handles authentication. Never store plaintext passwords or put service-role keys in browser code.

## Web search
The server calls Tavily only when the user clicks “Websuche” or the prompt clearly asks for current online research. Search results and URLs are shown in the chat. This is a basic search integration, not a full browser agent: it does not silently click through arbitrary pages or claim to have visited pages it did not retrieve.

## Files and video
Text files (`.txt`, `.md`, `.csv`, `.json`) are extracted into the model context. PDFs are currently accepted as uploads but not parsed in this starter; add a PDF extraction library/server-side processing to support PDF contents. Video files are uploaded and their name/size/type is passed as metadata only. Real video frame analysis needs a provider/model that supports video input or a frame-extraction pipeline (e.g. ffmpeg) and must be implemented for that provider. The UI makes this limitation explicit.

## Deployment
Deploy the Node server to a host that supports Node.js. Configure environment variables in the host's secret settings, then set the deployed URL in Supabase's allowed redirect URLs. Add HTTPS, rate limiting, request quotas, monitoring, and a privacy policy before public launch.

## Security notes
- API keys stay on the server in `.env`.
- The included upload limit is configurable.
- This is a starter and needs production hardening (rate limits, malware scanning, data retention/deletion controls, and robust file parsing).
- Chat history is local browser storage in this version, not synchronized across devices/accounts.


## Publish as a public website (Render)
This repository includes `render.yaml` as a deployment template.
1. Create a GitHub account and a new private repository (recommended).
2. Upload the extracted project files to that repository. Do not upload `.env` or any real API keys.
3. In Render, choose **New → Blueprint** and connect the repository, or create a **Web Service** from it.
4. Render should detect `render.yaml`. The service uses `npm install` and `npm start`.
5. In Render's Environment settings, enter your real values for `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and optionally `TAVILY_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Keep secrets in the host's secret settings.
6. Deploy. Render gives you a public `onrender.com` URL. You can later connect a custom domain.
7. Test chat, search, login, upload, mobile layout and deletion behavior before sharing the site.

The included free hosting tier may sleep after inactivity and external AI/search calls may cost money. Check current provider limits before launching.

## Before public launch — legal and safety checklist
- Complete and review `legal/DATENSCHUTZ-MUSTER.md` and `legal/NUTZUNGSBEDINGUNGEN-MUSTER.md` with real operator/contact/provider details. These templates are not legal advice and do not guarantee immunity from claims.
- Publish an appropriate privacy notice and legally required provider/contact information for your jurisdiction and audience.
- Review GDPR and any applicable AI-specific obligations with a qualified professional; assess data-processing agreements and any international transfers.
- Add rate limiting, abuse prevention, moderation, file scanning, account/chat deletion, backup/retention policy and monitoring.
- Confirm you have rights to your brand/name, design, uploaded content and any datasets; avoid copying another service's protected branding or UI assets.
- Do not claim unlimited/free usage or video understanding unless it is actually provided and financially sustainable.
