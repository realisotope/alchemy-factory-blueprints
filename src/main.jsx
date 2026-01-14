import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./lib/ThemeContext";
import { BlueprintFolderProvider } from "./lib/BlueprintFolderContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BlueprintFolderProvider>
        <App />
      </BlueprintFolderProvider>
    </ThemeProvider>
  </React.StrictMode>
);
