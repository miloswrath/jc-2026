import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PresenterApp from "./PresenterApp";
import "./index.css";

const root = document.getElementById("root");

if (root) {
  const isPresenter =
    window.location.pathname.startsWith("/presenter") ||
    window.location.search.includes("presenter=true");

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      {isPresenter ? <PresenterApp /> : <App />}
    </React.StrictMode>
  );
}
