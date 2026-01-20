import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./lib/ThemeContext";
import { BlueprintFolderProvider } from "./lib/BlueprintFolderContext";
import "./index.css";

const Root = (
  <ThemeProvider>
    <BlueprintFolderProvider>
      <App />
    </BlueprintFolderProvider>
  </ThemeProvider>
);

const element = import.meta.env.DEV ? (
  <React.StrictMode>
    {Root}
  </React.StrictMode>
) : Root;

ReactDOM.createRoot(document.getElementById("root")).render(element);
