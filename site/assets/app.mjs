import { splitPayment, formatUSDC } from "./payments.mjs";
const $ = (id) => document.getElementById(id),
  fr = document.documentElement.lang === "fr";
const largerText = $("home-larger-text");
if (largerText) {
  largerText.addEventListener("click", () => {
    const large = document.body.classList.toggle("large-text");
    largerText.setAttribute("aria-pressed", String(large));
  });
  largerText.disabled = false;
  largerText.hidden = false;
}
const roleButtons = [...document.querySelectorAll("[data-role]")];
function selectRole(id) {
  roleButtons.forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.role === id)),
  );
  document.querySelectorAll(".role-panel").forEach((panel) => {
    panel.hidden = panel.id !== `role-${id}`;
  });
}
document.querySelector(".role-controls").hidden = false;
roleButtons.forEach((button) =>
  button.addEventListener("click", () => selectRole(button.dataset.role)),
);
selectRole("employer");
function calculate() {
  try {
    const enteredCost = fr
      ? $("job-cost").value.replace(",", ".")
      : $("job-cost").value;
    const amounts = splitPayment(enteredCost, $("validator-rate").value);
    ["agent", "validators", "wallet30", "wallet10"].forEach((key) => {
      $(`amount-${key}`).textContent = formatUSDC(
        amounts[key],
        fr ? "fr" : "en",
      );
      document.querySelector(`.segment-${key}`).style.width =
        `${Number((amounts[key] * 10000n) / amounts.cost) / 100}%`;
    });
    $("calc-error").textContent = "";
    $("job-cost").removeAttribute("aria-invalid");
    $("validator-rate").removeAttribute("aria-invalid");
    return true;
  } catch (error) {
    const amountError = error.message === "amount";
    $("calc-error").textContent = amountError
      ? fr
        ? "Saisissez un montant positif, sans séparateur de milliers, avec au plus six décimales."
        : "Enter a positive amount, without thousands separators, with at most six decimal places."
      : fr
        ? "Saisissez un pourcentage entier de 1 à 60."
        : "Enter a whole-number validator percentage from 1 to 60.";
    $("job-cost").setAttribute("aria-invalid", String(amountError));
    $("validator-rate").setAttribute("aria-invalid", String(!amountError));
    ["agent", "validators", "wallet30", "wallet10"].forEach((key) => {
      $(`amount-${key}`).textContent = "—";
      document.querySelector(`.segment-${key}`).style.width = "0%";
    });
    return false;
  }
}
$("calculate").addEventListener("click", calculate);
[$("job-cost"), $("validator-rate")].forEach((input) => {
  input.addEventListener("input", calculate);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") calculate();
  });
});
document.querySelectorAll("[data-cost]").forEach((button) =>
  button.addEventListener("click", () => {
    $("job-cost").value = button.dataset.cost;
    calculate();
  }),
);
document
  .querySelectorAll(".calculator input, .calculator button, #copy-address")
  .forEach((control) => {
    control.disabled = false;
  });
calculate();
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
document.querySelector(".search-wrap").hidden = false;
$("guide-search").addEventListener("input", () => {
  const query = normalize($("guide-search").value).trim(),
    cards = [...document.querySelectorAll(".resource")];
  cards.forEach((card) => {
    card.hidden = !normalize(card.dataset.search).includes(query);
  });
  const count = cards.filter((card) => !card.hidden).length;
  $("no-results").hidden = count > 0;
  $("search-count").textContent = fr
    ? `${count} guide${count === 1 ? "" : "s"}`
    : `${count} guide${count === 1 ? "" : "s"}`;
});
$("copy-address").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("manager-address").textContent);
    $("copy-status").textContent = fr ? "Adresse copiée." : "Address copied.";
  } catch {
    $("copy-status").textContent = fr
      ? "Sélectionnez et copiez l’adresse ci-dessus."
      : "Select and copy the address above.";
  }
});
