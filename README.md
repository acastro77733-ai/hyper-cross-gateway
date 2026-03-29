<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7d1eb158-e8c9-433c-9506-34f1d57c9bd4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Configure Kaleido securely:
   `KALEIDO_RPC_URL` for backend telemetry and any optional server-side auth env vars your Kaleido endpoint requires
4. Optionally set `VITE_KALEIDO_PUBLIC_RPC_URL` only if you want wallets to be able to auto-add the Kaleido chain from the browser
5. Run the app:
   `npm run dev`
