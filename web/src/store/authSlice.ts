import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { User } from "@/types/api";

interface AuthState {
  status: boolean;
  userData: User | null;
  initializing: boolean;
}

const initialState: AuthState = {
  status: false,
  userData: null,
  initializing: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{ userData: User }>) => {
      state.status = true;
      state.userData = action.payload.userData;
      state.initializing = false;
    },
    logout: (state) => {
      state.status = false;
      state.userData = null;
      state.initializing = false;
    },
    setInitializing: (state, action: PayloadAction<boolean>) => {
      state.initializing = action.payload;
    },
  },
});

export const { login, logout, setInitializing } = authSlice.actions;
export default authSlice.reducer;
