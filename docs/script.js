document.querySelectorAll(".copy-btn").forEach((button) => {
  button.dataset.label = button.textContent;
  button.addEventListener("click", async () => {
    const text = button.dataset.copy;
    if (text == null) return;
    const label = button.dataset.label ?? "Copy";
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      button.classList.add("copied");
      button.classList.remove("copy-failed");
    } catch {
      button.textContent = "Copy failed";
      button.classList.add("copy-failed");
      button.classList.remove("copied");
    }
    setTimeout(() => {
      button.textContent = label;
      button.classList.remove("copied", "copy-failed");
    }, 2000);
  });
});
