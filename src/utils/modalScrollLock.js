// Port of Mutable's ModalScrollLock (components/system/ModalScrollLock.tsx):
// while any modal backdrop is in the DOM, body scrolling is disabled.
// Installed once from App.vue — modal components need no code of their own.
//
// The selector matches the backdrop pattern used in this app (.fixed.inset-0,
// rendered via v-if so it only exists while a modal is open). Reference-
// counted so stacked modals unlock only when the last one closes, and
// padding-compensated so the scrollbar disappearing doesn't shift the layout.
const MODAL_SELECTOR = ".fixed.inset-0";

let locks = 0;
let previousOverflow = "";
let previousPaddingRight = "";

function takeLock() {
  locks += 1;
  if (locks === 1) {
    previousOverflow = document.body.style.overflow;
    previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
}

function releaseLock() {
  locks -= 1;
  if (locks <= 0) {
    locks = 0;
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPaddingRight;
  }
}

export function installModalScrollLock() {
  const sync = () => {
    const open = document.querySelectorAll(MODAL_SELECTOR).length > 0;
    if (open) {
      if (locks === 0) takeLock();
    } else if (locks > 0) {
      releaseLock();
    }
  };

  sync();
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    while (locks > 0) releaseLock();
  };
}
