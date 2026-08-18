# Lean Next.js Dashboard & Stitch MCP Design Blueprint

## 1. Stitch MCP in Antigravity: Yes, Supported!

**Yes, you can absolutely use Stitch's MCP server directly inside Antigravity.**

Antigravity natively implements the **Model Context Protocol (MCP)** specification. You can connect local stdio MCP servers or remote SSE MCP servers in two ways:

### How to Configure Stitch MCP in Antigravity:
1. **Via Configuration File**:
   Add Stitch's MCP server definition to your global Antigravity config (`~/.gemini/config/mcp_config.json`):
   ```json
   {
     "mcpServers": {
       "stitch": {
         "command": "npx",
         "args": ["-y", "@stitch/mcp-server"],
         "env": {
           "STITCH_API_KEY": "your_stitch_api_key_here"
         }
       }
     }
   }
   ```
   *(Or if Stitch provides a remote SSE endpoint)*:
   ```json
   {
     "mcpServers": {
       "stitch": {
         "serverUrl": "https://stitch-mcp.your-endpoint.com/sse"
       }
     }
   }
   ```
2. **Via Antigravity UI**:
   - Open Antigravity $\rightarrow$ **Settings / Options (...)** $\rightarrow$ **MCP Servers**.
   - Add the Stitch server and enter the command / API key.
   - Once connected, Antigravity will discover Stitch's tools to read design tokens, screen components, and layout trees directly into code.

---

## 2. Authentication: NextAuth (Auth.js) vs Clerk

| Criteria | Clerk | NextAuth / Auth.js (Recommended) |
|---|---|---|
| **Production Cost** | Free up to 10k MAUs, but **multi-tenant Organizations & custom domains require paid plans** ($25-$99+/mo) | **100% Free Forever** (Zero cost, self-hosted) |
| **Data Ownership** | Stored on Clerk's cloud | Stored directly in your PostgreSQL `users` table |
| **Multi-Tenancy** | Requires Clerk Organizations setup | Simple `tenantId` & `role` field on JWT session |
| **Backend Integration** | Need to verify Clerk JWTs in Express | Direct database lookup & signed JWTs |
| **Vendor Lock-in** | High | None |

> [!TIP]
> **Recommendation:** **NextAuth.js (Auth.js)** or a lightweight JWT/Session system. It gives you 100% control, zero recurring fees in production, and maps cleanly to our existing PostgreSQL `users` and `tenants` tables.

---

## 3. The Lean Role & Permission Model

We are keeping this minimal, practical, and clean:

```
┌────────────────────────────────────────────────────────┐
│                      AUTH GATEWAY                      │
│                  (NextAuth / JWT Login)                │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
      role: 'super_admin'         role: 'clinic_admin'
               │                          │
┌──────────────▼─────────────┐ ┌──────────▼──────────────┐
│     SUPER ADMIN PORTAL     │ │   CLINIC ADMIN PORTAL    │
│                            │ │                          │
│ • Add New Clinic           │ │ • Today's Live Queue     │
│ • Toggle Reminders/Alerts  │ │ • View/Print QR Standee  │
│ • Suspend / Soft-Delete    │ │ • Upcoming Slots List    │
└────────────────────────────┘ └──────────────────────────┘
```

### Role 1: Super Admin (Platform Owner — Us)
- **Add New Clinic**: Name, WhatsApp Phone Number ID, WhatsApp Display Number, Timezone.
- **Manage Settings**: Toggle `reminders_enabled` and `notifications_enabled` per clinic.
- **Revoke Access (Soft Delete)**: Set clinic `status = 'suspended'`. Suspended clinics cannot receive/send messages or log into the dashboard.
- **View All QR Codes**: Instant access to any clinic's QR code & standee.

### Role 2: Clinic Admin (Single Role for Clinic — Doctor/Receptionist)
- **Today's Appointments Queue**: See today's tokens, patient names, time slots, and status (`Booked`, `Done`, `No-Show`).
- **QR Code & Counter Standee**: View live preview, copy Click-to-Chat `wa.me` link, download high-res PNG/SVG, and print A4 counter standee.
- **Schedule Overview**: View bookable slots and dates for the clinic's doctor.

---

## 4. Minimal Screen Inventory (Max 4 Clean Screens)

We will avoid screen bloat and build only the essential, high-impact pages using **Next.js 15 App Router + Tailwind CSS + Shadcn UI**.

### Screen 1: Login Page (`/login`)
- Clean, centered minimalist card.
- Email / Phone + Password.
- Automatically routes user based on role:
  - `super_admin` $\rightarrow$ `/super-admin`
  - `clinic_admin` $\rightarrow$ `/dashboard`

---

### Screen 2 (Super Admin): Clinics Directory & Control (`/super-admin`)
- **Header**: Stats overview (Active Clinics, Suspended Clinics).
- **Primary Action**: `[ + Add Clinic ]` button (opens clean modal).
- **Clinics Table**:
  - Clinic Name & Phone Number
  - Reminder & Notification toggle switches (instant autosave)
  - `[ View QR ]` action button
  - `[ Suspend / Revoke ]` soft-delete button with confirmation
- **Add Clinic Modal**:
  - Clinic Name (e.g. "Green Valley Clinic")
  - Meta Phone Number ID (e.g. `1209654505573202`)
  - WhatsApp Display Number (e.g. `+91 70020 59544`)
  - Initial Doctor Name & Specialization

---

### Screen 3 (Clinic Admin): Today's Live Queue (`/dashboard`)
- **Top Bar**: Clinic Name, Date pill (`Today: Tue, 18 Aug 2026`), Total Patients Today.
- **Live Queue Table / Cards**:
  - Token Number (e.g. `#1`, `#2`)
  - Patient Name & Age (e.g. "Rahul Sharma, 34")
  - Time Slot (e.g. `09:30 AM`)
  - Reason / Chief Complaint
  - Quick Action Buttons: `[ Mark Done ✓ ]` / `[ No-Show ]`
- **Upcoming Dates Tabs**: Quick switch to see tomorrow or upcoming days.

---

### Screen 4 (Clinic Admin): WhatsApp QR Code & Standee (`/dashboard/qr`)
- **Live Scannable QR Code** with WhatsApp branding.
- **Deep Link Box**: `https://wa.me/917002059544?text=Hi` with `[ Copy Link ]` button.
- **Download Buttons**: `[ Download PNG (High-Res) ]`, `[ Download SVG (Vector) ]`.
- **Print Standee Button**: One-click open and print A4 counter standee flyer.

---

## 5. Design System (Subtle, Modern & High UX)

Using **Stitch** for design tokens and layout composition, paired with **Shadcn UI**:
- **Palette**:
  - Background: Crisp pure white `#FFFFFF` / dark slate `#0F172A`
  - Panels & Cards: Subtle grey `#F8FAFC` with 1px border `#E2E8F0`
  - Primary Accent: Deep Medical Teal `#0F766E` (Active state: `#115E59`)
  - WhatsApp Green: `#25D366` for WhatsApp badges and Click-to-Chat buttons
  - Soft status badges: Green (Completed), Blue (Booked), Red (Cancelled/No-show)
- **Typography**: Clean, highly readable sans-serif (`Geist` or `Inter`).
- **Feedback**: Instant optimistic UI updates with sonner/toast notifications (`"Saved"`, `"Clinic Suspended"`).

---

## 6. Next Steps

1. **Stitch Integration**: Connect Stitch MCP server in Antigravity to craft the UI tokens and layout mockups.
2. **Next.js App Setup**: Initialize the Next.js frontend with Shadcn UI, NextAuth, and Tailwind.
3. **Backend Auth Route Extension**: Add JWT/Session support to Express for NextAuth verification and clinic soft-delete endpoint (`PATCH /api/admin/tenants/:id/status`).
