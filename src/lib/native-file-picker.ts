const FLAG = "data-native-file-picker-open";

export function markNativeFilePickerOpen() {
  document.documentElement.setAttribute(FLAG, "true");
}

export function clearNativeFilePickerOpen() {
  document.documentElement.removeAttribute(FLAG);
}

export function bindNativeFilePickerCloseListeners() {
  function clear() {
    clearNativeFilePickerOpen();
  }

  window.addEventListener("focus", clear);
  document.addEventListener("visibilitychange", clear);

  return () => {
    window.removeEventListener("focus", clear);
    document.removeEventListener("visibilitychange", clear);
  };
}
