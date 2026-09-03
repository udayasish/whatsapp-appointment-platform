import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Appointment } from "@/types/api";

const INITIAL_QUEUE: Appointment[] = [
  {
    id: "apt-1",
    tokenNumber: 1,
    patientName: "Rahul Sharma",
    patientAge: 38,
    patientPhone: "+91 98765 43210",
    timeSlot: "09:00 AM",
    complaint: "Fever & headache for 2 days",
    status: "completed",
  },
  {
    id: "apt-2",
    tokenNumber: 2,
    patientName: "Sunita Devi",
    patientAge: 45,
    patientPhone: "+91 98000 11223",
    timeSlot: "09:15 AM",
    complaint: "Routine BP & Sugar checkup",
    status: "booked",
  },
  {
    id: "apt-3",
    tokenNumber: 3,
    patientName: "Amitav Borah",
    patientAge: 29,
    patientPhone: "+91 70020 59544",
    timeSlot: "09:30 AM",
    complaint: "Throat pain & dry cough",
    status: "booked",
  },
  {
    id: "apt-4",
    tokenNumber: 4,
    patientName: "Pooja Roy",
    patientAge: 31,
    patientPhone: "+91 99887 76655",
    timeSlot: "09:45 AM",
    complaint: "Allergy follow-up & prescription",
    status: "booked",
  },
];

interface QueueState {
  items: Appointment[];
  selectedDate: string;
  loading: boolean;
}

const initialState: QueueState = {
  items: INITIAL_QUEUE,
  selectedDate: "today",
  loading: false,
};

const queueSlice = createSlice({
  name: "queue",
  initialState,
  reducers: {
    setQueue: (state, action: PayloadAction<Appointment[]>) => {
      state.items = action.payload;
    },
    markDone: (state, action: PayloadAction<string>) => {
      const apt = state.items.find((item) => item.id === action.payload);
      if (apt) {
        apt.status = "completed";
      }
    },
    markNoShow: (state, action: PayloadAction<string>) => {
      const apt = state.items.find((item) => item.id === action.payload);
      if (apt) {
        apt.status = "noshow";
      }
    },
    setSelectedDate: (state, action: PayloadAction<string>) => {
      state.selectedDate = action.payload;
    },
  },
});

export const { setQueue, markDone, markNoShow, setSelectedDate } =
  queueSlice.actions;

export default queueSlice.reducer;
