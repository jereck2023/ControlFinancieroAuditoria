// JSDOM has no top layer, focus trap or dialog methods. Browser checks cover those.
export function stubDialogMethods(): () => void {
  const prototype = HTMLDialogElement.prototype;
  const showModal = Object.getOwnPropertyDescriptor(prototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(prototype, 'close');
  const scrollTo = window.scrollTo;
  window.scrollTo = () => {};
  Object.defineProperty(prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  return () => {
    window.scrollTo = scrollTo;
    if (showModal) Object.defineProperty(prototype, 'showModal', showModal);
    else Reflect.deleteProperty(prototype, 'showModal');
    if (close) Object.defineProperty(prototype, 'close', close);
    else Reflect.deleteProperty(prototype, 'close');
  };
}
