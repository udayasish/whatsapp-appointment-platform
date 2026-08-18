# Dashboard Design & UX Specification

This document presents the visual design and UX specification for the **Super Admin** and **Clinic Admin** web dashboard.

---

## 🎨 Visual Preview & Live Prototype

You can view and interactively test the complete prototype live in your browser:
- **Local URL**: [`http://localhost:3000/design-preview/`](http://localhost:3000/design-preview/)
- **Direct File**: [`public/design-preview/index.html`](file:///d:/Projects/whatsapp-appointment-platform/public/design-preview/index.html)

Use the top switcher bar to test all 4 screens and interactive modals:
1. **Screen 1: Clean Login**
2. **Screen 2: Super Admin Portal** (Add Clinic modal, Reminders toggle, Suspend/Revoke access)
3. **Screen 3: Clinic Admin — Today's Patient Queue** (Live token pills, 1-click "Mark Done" / "No-Show")
4. **Screen 4: Clinic Admin — WhatsApp QR & Standee Hub** (Scannable QR, deep link copy, PNG/SVG downloads, counter standee print)

---

## 📐 Design Tokens & Palette

| Token | Value / Class | Purpose |
|---|---|---|
| **Background** | `#F8FAFC` (`bg-slate-50`) | Soft, calming neutral background |
| **Card Surface** | `#FFFFFF` (`bg-white border-slate-200`) | Clean floating cards with crisp 1px borders |
| **Primary Brand** | `#0F766E` (`bg-teal-700 hover:bg-teal-800`) | Deep healthcare teal for primary actions and active states |
| **WhatsApp Green**| `#25D366` (`bg-wa-green`) | WhatsApp badges, Click-to-Chat buttons, and QR framing |
| **Typography** | `Inter` / `Geist` (`font-sans`) | High legibility at small sizes (11px labels to 24px headers) |

### Status Badge Tokens
- **Completed**: `bg-emerald-50 text-emerald-700 border-emerald-200`
- **Booked / Waiting**: `bg-blue-50 text-blue-700 border-blue-200`
- **No-Show / Suspended**: `bg-rose-50 text-rose-700 border-rose-200`
- **Super Admin Badge**: `bg-purple-50 text-purple-700 border-purple-200`
- **Clinic Admin Badge**: `bg-teal-50 text-teal-700 border-teal-200`

---

## 🖥️ Screen Layout Specifications

### 1. Super Admin View (`/super-admin`)
```
┌────────────────────────────────────────────────────────────────────────┐
│ 🏥 ClinicConnect  [Super Admin]                    [ + Add New Clinic ]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ ┌────────────────┐ ┌────────────────┐ ┌──────────────────────────────┐ │
│ │ Active Clinics │ │   Suspended    │ │ Total Bookable Slots         │ │
│ │       2        │ │       0        │ │             568              │ │
│ └────────────────┘ └────────────────┘ └──────────────────────────────┘ │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Registered Clinics                                                 │ │
│ │ ────────────────────────────────────────────────────────────────── │ │
│ │ Bang Clinic      [Active]  Reminders:[ON]  Alerts:[ON]  [📱 View QR]│ │
│ │ +91 88760 64436                                         [ Suspend ]│ │
│ │                                                                    │ │
│ │ Sunrise Clinic   [Active]  Reminders:[ON]  Alerts:[ON]  [📱 View QR]│ │
│ │ +1 (555) 000-1111                                       [ Suspend ]│ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. Clinic Admin Live Queue View (`/dashboard`)
```
┌────────────────────────────────────────────────────────────────────────┐
│ 🏥 Sunrise Clinic  [Clinic Admin]             [ 📱 QR Code & Standee ] │
│    Dr. Asha Verma (General Physician)                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ 📅 Schedule: [ Today (Tue, 18 Aug) ] [ Tomorrow ] [ Thu, 20 Aug ]      │
│    Total Today: 4 Booked  •  Done: 1  •  Waiting: 3                    │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Today's Patient Queue                          Live WhatsApp Feed  │ │
│ │ ────────────────────────────────────────────────────────────────── │ │
│ │ [#1]  Rahul Sharma (38)  09:00 AM  Fever [Completed ✓]             │ │
│ │                                                                    │ │
│ │ [#2]  Sunita Devi  (45)  09:15 AM  BP Check                        │ │
│ │       [Booked (Waiting)]         --> [ Mark Done ✓ ]  [ No-Show ]  │ │
│ │                                                                    │ │
│ │ [#3]  Amitav Borah (29)  09:30 AM  Cough                           │ │
│ │       [Booked (Waiting)]         --> [ Mark Done ✓ ]  [ No-Show ]  │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Key Interactive Behaviors to Test

1. **Add Clinic Modal**: Click `Add New Clinic` in Super Admin mode to preview the input fields and validation.
2. **Instant Status Toggles**: Flip the Reminders/Alerts toggle switches to see optimistic toast feedback.
3. **Queue Status Actions**: In the Clinic Queue view, click `Mark Done ✓` or `No-Show` on Token `#2` / `#3` to see the live badge state update.
4. **Copy Deep Link**: In the QR Hub view, click `Copy Link` to copy the `https://wa.me/...` URL to your clipboard.
