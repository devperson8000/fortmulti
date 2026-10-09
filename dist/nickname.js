import { nickname } from "./hcs-rules.js";
export function requireNickname() {
  const dialog = document.getElementById("nickname-gate"),
    form = document.getElementById("nickname-form"),
    input = document.getElementById("nickname-input"),
    error = document.getElementById("nickname-error");
  try {
    const saved = JSON.parse(localStorage.getItem("horizon-callsign"));
    if (saved?.name) {
      nickname(saved.name);
      return Promise.resolve(saved.name);
    }
  } catch {}
  dialog.addEventListener("cancel", (event) => event.preventDefault());
  dialog.showModal();
  return new Promise((resolve) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const name = nickname(input.value);
        try {
          localStorage.setItem("horizon-callsign", JSON.stringify({ name }));
          const profile = JSON.parse(
            localStorage.getItem("duel-profile") || "{}",
          );
          localStorage.setItem(
            "duel-profile",
            JSON.stringify({
              ...profile,
              name,
              color: profile.color || "408faf",
            }),
          );
        } catch {}
        dialog.close();
        resolve(name);
      } catch (e) {
        error.textContent = e.message;
        input.focus();
      }
    });
  });
}
export function restoreIdentity() {
  try {
    const saved = JSON.parse(localStorage.getItem("horizon-identity"));
    if (saved?.refresh_token && !sessionStorage.getItem("sunny-auth-v3"))
      sessionStorage.setItem("sunny-auth-v3", JSON.stringify(saved));
  } catch {}
}
export function rememberIdentity(session) {
  if (session?.refresh_token)
    try {
      localStorage.setItem("horizon-identity", JSON.stringify(session));
    } catch {}
}
