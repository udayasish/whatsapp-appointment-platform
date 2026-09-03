import { configureStore } from "@reduxjs/toolkit";
import authSlice from "./authSlice";
import clinicsSlice from "./clinicsSlice";
import queueSlice from "./queueSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authSlice,
      clinics: clinicsSlice,
      queue: queueSlice,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
