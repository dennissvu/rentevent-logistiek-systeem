import { describe, it, expect } from "vitest";
import { getUserFriendlyLoginError } from "@/pages/Login";
import { getRedirectToAfterLogin } from "@/utils/authRedirect";

describe("getUserFriendlyLoginError", () => {
  it("returns Dutch message for invalid login credentials", () => {
    expect(getUserFriendlyLoginError("Invalid login credentials")).toBe(
      "Ongeldig e-mailadres of wachtwoord."
    );
    expect(getUserFriendlyLoginError("Invalid_credentials")).toBe(
      "Ongeldig e-mailadres of wachtwoord."
    );
  });

  it("returns Dutch message for email not confirmed", () => {
    expect(getUserFriendlyLoginError("Email not confirmed")).toBe(
      "Bevestig eerst je e-mailadres."
    );
  });

  it("returns Dutch message for rate limit / too many requests", () => {
    expect(getUserFriendlyLoginError("Too many requests")).toBe(
      "Te veel pogingen. Wacht even en probeer het opnieuw."
    );
  });

  it("returns Dutch message for network errors", () => {
    expect(getUserFriendlyLoginError("Network error")).toBe(
      "Geen verbinding. Controleer je internet en probeer opnieuw."
    );
  });

  it("returns generic safe message for unknown errors", () => {
    expect(getUserFriendlyLoginError("Some internal server error")).toBe(
      "Inloggen mislukt. Controleer je gegevens en probeer het opnieuw."
    );
  });
});

describe("getRedirectToAfterLogin", () => {
  it("returns / when no from state", () => {
    expect(getRedirectToAfterLogin(null)).toBe("/");
    expect(getRedirectToAfterLogin({})).toBe("/");
  });

  it("returns / when from is /login to avoid redirect loop", () => {
    expect(getRedirectToAfterLogin({ from: { pathname: "/login" } })).toBe("/");
  });

  it("returns the from pathname when valid", () => {
    expect(getRedirectToAfterLogin({ from: { pathname: "/orders" } })).toBe("/orders");
    expect(getRedirectToAfterLogin({ from: { pathname: "/planning" } })).toBe("/planning");
  });
});
