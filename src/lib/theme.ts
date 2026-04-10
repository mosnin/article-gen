export function getTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("theme") as "light" | "dark") ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function setTheme(theme: "light" | "dark") {
  localStorage.setItem("theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function initTheme() {
  setTheme(getTheme());
}
