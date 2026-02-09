import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";
import PresenterApp from "../PresenterApp";

describe("App", () => {
  it("renders the scaffold message", () => {
    render(<App />);
    expect(screen.getByText(/Enter your name/i)).toBeInTheDocument();
  });
});

describe("PresenterApp", () => {
  it("renders the presenter header", () => {
    render(<PresenterApp />);
    expect(screen.getByText(/Live Wall/i)).toBeInTheDocument();
  });
});
