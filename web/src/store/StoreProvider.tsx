"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "./store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialiser: created once per client, not per render.
  const [store] = useState(makeStore);

  return <Provider store={store}>{children}</Provider>;
}
