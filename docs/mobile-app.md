# Mobile apps (Android first, then iPhone)

Status on 2026-10-31: **installable web app is live; Android Play Store build and iOS are planned, not built.** Keep planned, built, tested and published states separate when updating this file.

## 1. Installable web app (done)

The live site is a Progressive Web App: web manifest, icons (including a maskable one and an iOS home-screen icon), and a small service worker that makes it installable and shows the last app shell offline. It never caches API or photo requests and always tries the network first for pages, so deploys are picked up immediately.

- Android Chrome: menu, then Install app (or Add to Home screen). Laptop Chrome/Edge: install icon in the address bar. iPhone Safari: Share, then Add to Home Screen. The in-app page `/install` explains this and offers a one-tap button where the browser allows it.
- Checked: manifest and icons parse and load, the service worker registers, activates and caches the shell in real Chrome (tested against a local Pages-style build). Not checked: installation on a physical phone.

## 2. Android app for the Play Store (planned)

**Approach: Capacitor.** The existing React build is bundled into a native Android shell, so the web code is reused unchanged. Reasons: no domain-root verification file is needed (a Trusted Web Activity would need `/.well-known/assetlinks.json` at the origin root, which a `github.io` project path cannot provide without a custom domain or a second repository), native extras are possible, and the same project later produces the iOS app.

Known work items (owner decisions marked):
1. **Google sign-in inside the app.** Google blocks OAuth in embedded WebViews, so sign-in must open the system browser (Chrome Custom Tab) and return through a deep link; add that redirect to the Supabase allow-list. The Google Cloud client does not change.
2. **Account deletion (Play requirement).** Add a Delete my account action in the app and a public web page describing how to request deletion; add a database function that removes the user's data. Needs a new migration, so it follows the usual live-database approval.
3. **Store listing:** short and long description, 512 px icon, 1024x500 feature graphic, phone screenshots, content rating questionnaire, Data safety form (email, name, photos, messages are collected; deletable on request; nothing sold or shared for ads), privacy policy URL (already live), target audience not children, user-generated-content moderation (report and block exist).
4. **Package name (owner decision, permanent once published).** Proposal: `io.github.abhikrao.iiitdblackmarket`. The app is not affiliated with IIIT-Delhi; the name and icon must not imply it is official, or Google may reject it as impersonation. Ask the institute if an official name is wanted.
5. **Signing.** Release builds are signed with an upload key generated on the owner's machine; the owner must back it up (loss blocks updates). Play App Signing holds the final key.
6. **Reviewer access.** Sign-in is limited to `@iiitd.ac.in` accounts, so Google's reviewers cannot log in unless they are given a working institute account or a controlled review path. Options: ask IIITD IT for a test account, or add a narrowly scoped, documented review account. Decide before the first review.
7. **Optional later: push notifications** (Firebase Cloud Messaging plus a sender on the database side) so new messages arrive when the app is closed. Not required for the first release.

**Tools to install on the Mac (about 2 GB; needs the owner's permission and acceptance of Google's Android SDK licence):** JDK 21 and the Android SDK command-line tools through Homebrew. This Mac currently has Java 8 only, no Android SDK and no Xcode.

**Owner prerequisites (only the owner can do these):**
- A Google Play Console developer account: one-time US$25 fee and identity verification.
- Under Google's current rules for new personal developer accounts, a closed test with at least 12 testers for 14 consecutive days is required before production access. Confirm the exact numbers in the Play Console when creating the account. Start recruiting testers (Android phone owners; their Google account emails) early because the 14 days run before the public release.

Rough order: toolchain, Capacitor project and sign-in deep link, debug APK for the owner's phone, account deletion, store assets, signed AAB, Play internal and closed testing, production.

## 3. iPhone app (later)

Same Capacitor project. Needs: Apple Developer Program (US$99 a year), Xcode (large download) on the Mac, App Store review. Points to prepare: minimum-functionality guideline (a plain website wrapper is rejected, so the app needs genuine native integration), in-app account deletion, and the sign-in rule for third-party login (apps that exclusively use an institution's own account system are exempt from also offering Sign in with Apple; verify at submission). The installable web app already works on iPhone through Add to Home Screen in the meantime.

## 4. Not done yet

Everything in sections 2 and 3, installation on a physical phone, and any store account.
