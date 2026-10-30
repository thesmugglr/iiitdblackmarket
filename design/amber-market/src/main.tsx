import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AmberMarketplace } from "./AmberMarketplace";
import "./theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AmberMarketplace />
  </StrictMode>,
);
