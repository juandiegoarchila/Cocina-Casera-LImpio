//src/utils/Helpers.js
export const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const encodeMessage = (text) => encodeURIComponent(text);