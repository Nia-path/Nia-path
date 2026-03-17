# 🛡️ Nia Path AI
**The stealth digital witness and legal protector for women in Kenya.**

*Built for the IWD 2026 Hackathon*

---

##  The Problem: The Surveillance Trap
In Kenya, the legal system relies on evidence and timely reporting. But for women facing domestic violence or property grabbing, their smartphone—their only lifeline—is often their greatest vulnerability. 
1. **Surveillance:** Abusive partners frequently control or monitor devices. Downloading a traditional legal aid or SOS app puts the victim at immediate physical risk.
2. **Ephemeral Evidence:** Cases routinely collapse because critical evidence (photos of injuries, audio of threats) is found on the device and destroyed by the abuser before it reaches court.
3. **Legal Isolation:** Victims are paralyzed by fear, language barriers, and complex legal jargon, isolating them from their rights under laws like the Matrimonial Property Act.

##  The Solution: Protection in Complete Stealth
Nia Path solves this by transforming a vulnerable smartphone into an impenetrable, automated justice pipeline that operates in complete stealth.

### 1. The Functional Decoy (Stealth UI)
To combat device surveillance, Nia Path does not look like a safety app. On the surface, the Next.js frontend is a fully functional, ordinary "Savings & Expense Tracker." If a device is forcibly opened, the abuser sees nothing suspicious. The true application is strictly locked behind a state-change triggered only by a secret user PIN. 

### 2. AI Justice Advisor ("Nia")
Once unlocked, users interact with an advanced AI legal assistant powered by **Google Gemini 2.5 Flash**. Nia is engineered with a strict system prompt to analyze situations against Kenyan law, providing localized guidance in English and Swahili while outputting strict JSON to evaluate real-time threat levels.

### 3. Immutable Evidence Vault
To ensure legal admissibility in Kenyan courts, uploaded photos and audio files are securely locked in Supabase Storage. Our backend instantly generates a cryptographic **SHA-256 Checksum** for every file, creating an unbreakable, timestamped chain of custody even if the original file is deleted from the phone gallery.

---

##  Technical Architecture & Tech Stack

* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons. (Fully responsive: PWA on mobile, Sidebar Dashboard on desktop).
* **Backend & Database:** Supabase (PostgreSQL, Row Level Security, Edge Functions, Storage Buckets).
* **AI Engine:** Google Gemini 2.5 Flash API.
* **Orchestration & Automation:** n8n.

---

##  The Automated Justice Pipeline (Workflows)

Nia Path relies on complex backend orchestration to keep the user safe. Traditional loading spinners or app delays can alert an abuser that an SOS is being sent. To prevent this, all critical actions are offloaded to **n8n background workflows** authenticated via strict headers (`x-nia-secret`).

### `NIA-001`: Emergency SOS Dispatch
When a user presses the SOS button, they cannot afford to wait for network confirmation.
1. The Next.js API (`/api/emergency/alert/route.ts`) immediately returns a `200 OK` to the frontend so the UI remains fast and fluid.
2. In the background, it fires a secure webhook to the n8n orchestrator.
3. **n8n Automation:** The workflow validates the custom `x-nia-secret` header, extracts the user's geolocation and emergency contacts from the Supabase database, and silently dispatches distress signals to local Kenyan Police Gender Desks or trusted NGOs.

### `NIA-002`: AI Risk Escalation
Nia Path actively monitors conversations for critical danger without user intervention.
1. A user chats with the AI (`/api/ai/chat/route.ts`).
2. Gemini processes the chat and outputs a JSON schema including a `risk_level` (Low, Medium, High, Critical).
3. If the risk is assessed as `High` or `Critical`, the Next.js backend bypasses standard routing and hits the `AI_RISK_ESCALATION` n8n webhook.
4. **n8n Automation:** n8n silently opens a high-priority case file in the database and alerts assigned legal aid workers that a user is in immediate danger, all while the user continues their chat seamlessly.

### `NIA-003`: Evidence Chain of Custody
1. A user uploads a sensitive photo (`/api/evidence/upload/route.ts`).
2. The file is streamed directly to a secure Supabase Storage bucket.
3. A Supabase Edge Function (`verify-evidence-checksum`) is triggered.
4. The function computes a SHA-256 cryptographic hash of the file buffer and saves the hash, file size, and exact timestamp to the PostgreSQL database, ensuring the evidence cannot be repudiated in court.

---

##  Local Development Setup

### Prerequisites
* Node.js 18+
* A Supabase Project
* A Google Gemini API Key
* A local or cloud instance of n8n

