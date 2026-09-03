import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Clinic } from "@/types/api";

const INITIAL_CLINICS: Clinic[] = [
  {
    id: "100000000000001",
    name: "Sunrise Clinic",
    whatsappDisplayNumber: "+1 (555) 000-1111",
    whatsappPhoneNumberId: "100000000000001",
    status: "active",
    remindersEnabled: true,
    notificationsEnabled: true,
    doctorName: "Dr. Asha Verma",
    specialization: "General Physician",
    waMeUrl: "https://wa.me/15550001111?text=Hi",
    posterUrl: "/qr/100000000000001/poster",
    imageUrl: "/qr/100000000000001/image",
  },
  {
    id: "1214681811733273",
    name: "Bang Clinic",
    whatsappDisplayNumber: "+91 88760 64436",
    whatsappPhoneNumberId: "1214681811733273",
    status: "active",
    remindersEnabled: true,
    notificationsEnabled: true,
    doctorName: "Dr. Rajesh Sharma",
    specialization: "Cardiologist",
    waMeUrl: "https://wa.me/918876064436?text=Hi",
    posterUrl: "/qr/1214681811733273/poster",
    imageUrl: "/qr/1214681811733273/image",
  },
];

interface ClinicsState {
  items: Clinic[];
  loading: boolean;
}

const initialState: ClinicsState = {
  items: INITIAL_CLINICS,
  loading: false,
};

const clinicsSlice = createSlice({
  name: "clinics",
  initialState,
  reducers: {
    setClinics: (state, action: PayloadAction<Clinic[]>) => {
      state.items = action.payload;
    },
    toggleReminder: (state, action: PayloadAction<string>) => {
      const clinic = state.items.find((c) => c.id === action.payload);
      if (clinic) {
        clinic.remindersEnabled = !clinic.remindersEnabled;
      }
    },
    toggleAlerts: (state, action: PayloadAction<string>) => {
      const clinic = state.items.find((c) => c.id === action.payload);
      if (clinic) {
        clinic.notificationsEnabled = !clinic.notificationsEnabled;
      }
    },
    toggleStatus: (state, action: PayloadAction<string>) => {
      const clinic = state.items.find((c) => c.id === action.payload);
      if (clinic) {
        clinic.status = clinic.status === "active" ? "suspended" : "active";
      }
    },
    addClinic: (state, action: PayloadAction<Clinic>) => {
      state.items.unshift(action.payload);
    },
  },
});

export const {
  setClinics,
  toggleReminder,
  toggleAlerts,
  toggleStatus,
  addClinic,
} = clinicsSlice.actions;

export default clinicsSlice.reducer;
